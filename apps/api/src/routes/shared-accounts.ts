import { Router } from 'express';
import { tenantStorage, db, initTenantDatabase } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';
import {
  getSharedAccount,
  getMemberSharedAccounts,
  getOwnerSharedAccounts,
  createInvite,
  getInviteByToken,
  consumeInvite,
  addMember,
  removeMember,
  deleteSharedAccount,
  isMemberOrOwner,
} from '../db/registry.js';
import type { SharedAccountInfo, SharedBalance, SharedBalanceResult, TransactionWithDetails, TransactionSplit } from '@financer/shared';

export const sharedAccountsRouter = Router();

// Helper: get current tenant from AsyncLocalStorage
function currentTenant(): string {
  const t = tenantStorage.getStore();
  if (!t) throw new Error('No tenant context');
  return t;
}

// Helper: run a function in the owner's DB context
async function inOwnerDb<T>(ownerTenant: string, fn: () => T): Promise<T> {
  await initTenantDatabase(ownerTenant);
  return new Promise<T>((resolve, reject) => {
    tenantStorage.run(ownerTenant, () => {
      try {
        resolve(fn());
      } catch (e) {
        reject(e);
      }
    });
  });
}

// All routes (except join preview) require auth
sharedAccountsRouter.use(authMiddleware);

// GET /shared-accounts — list all shared accounts for current tenant (as owner and as member)
sharedAccountsRouter.get('/', async (_req, res) => {
  try {
    const tenant = currentTenant();

    const ownedRaw = getOwnerSharedAccounts(tenant);
    const memberRaw = getMemberSharedAccounts(tenant);

    const results: SharedAccountInfo[] = [];

    for (const sa of ownedRaw) {
      const full = getSharedAccount(sa.uuid)!;
      const accountData = await inOwnerDb(tenant, () =>
        db.prepare('SELECT name, initial_balance + COALESCE((SELECT SUM(CASE WHEN t.type=\'income\' THEN t.amount WHEN t.type=\'expense\' THEN -t.amount WHEN t.type=\'transfer\' AND t.account_id=a.id THEN -t.amount WHEN t.type=\'transfer\' AND t.transfer_to_account_id=a.id THEN t.amount ELSE 0 END) FROM transactions t WHERE t.account_id=a.id OR t.transfer_to_account_id=a.id),0) as balance FROM accounts a WHERE a.id=?').get(sa.accountId) as { name: string; balance: number } | undefined
      );
      results.push({
        uuid: sa.uuid,
        ownerTenant: sa.ownerTenant,
        accountId: sa.accountId,
        accountName: accountData?.name ?? '(unbekannt)',
        balance: accountData?.balance ?? 0,
        createdAt: sa.createdAt,
        members: full.members.map(m => ({ tenant: m.memberTenant, displayName: m.displayName, joinedAt: m.joinedAt })),
        isOwner: true,
        mode: sa.mode,
      });
    }

    for (const sa of memberRaw) {
      const full = getSharedAccount(sa.uuid)!;
      const accountData = await inOwnerDb(sa.ownerTenant, () =>
        db.prepare('SELECT name, initial_balance + COALESCE((SELECT SUM(CASE WHEN t.type=\'income\' THEN t.amount WHEN t.type=\'expense\' THEN -t.amount WHEN t.type=\'transfer\' AND t.account_id=a.id THEN -t.amount WHEN t.type=\'transfer\' AND t.transfer_to_account_id=a.id THEN t.amount ELSE 0 END) FROM transactions t WHERE t.account_id=a.id OR t.transfer_to_account_id=a.id),0) as balance FROM accounts a WHERE a.id=?').get(sa.accountId) as { name: string; balance: number } | undefined
      );
      results.push({
        uuid: sa.uuid,
        ownerTenant: sa.ownerTenant,
        accountId: sa.accountId,
        accountName: accountData?.name ?? '(unbekannt)',
        balance: accountData?.balance ?? 0,
        createdAt: sa.createdAt,
        members: full.members.map(m => ({ tenant: m.memberTenant, displayName: m.displayName, joinedAt: m.joinedAt })),
        isOwner: false,
        mode: full.mode,
      });
    }

    res.json({ success: true, data: results });
  } catch (err) {
    console.error('GET /shared-accounts error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /shared-accounts/join/:token — preview invite (no auth on purpose — check manually)
// Note: auth middleware is above, but this route is for logged-in users
sharedAccountsRouter.get('/join/:token', async (req, res) => {
  try {
    const invite = getInviteByToken(req.params.token);
    if (!invite) {
      res.status(404).json({ success: false, error: 'Einladung nicht gefunden / Invite not found' });
      return;
    }
    if (invite.used) {
      res.status(410).json({ success: false, error: 'Einladung wurde bereits verwendet / Invite already used' });
      return;
    }
    const isUnlimited = invite.expiresAt.startsWith('9999');
    if (!isUnlimited && new Date(invite.expiresAt) < new Date()) {
      res.status(410).json({ success: false, error: 'Einladung abgelaufen / Invite expired' });
      return;
    }

    const sa = getSharedAccount(invite.sharedUuid);
    if (!sa) {
      res.status(404).json({ success: false, error: 'Geteiltes Konto nicht gefunden / Shared account not found' });
      return;
    }

    const accountData = await inOwnerDb(sa.ownerTenant, () =>
      db.prepare('SELECT name FROM accounts WHERE id = ?').get(sa.accountId) as { name: string } | undefined
    );

    res.json({
      success: true,
      data: {
        sharedUuid: invite.sharedUuid,
        ownerTenant: sa.ownerTenant,
        accountName: accountData?.name ?? '(unbekannt)',
        expiresAt: invite.expiresAt,
      },
    });
  } catch (err) {
    console.error('GET /shared-accounts/join/:token error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /shared-accounts/join/:token — join a shared account
sharedAccountsRouter.post('/join/:token', async (req, res) => {
  try {
    const tenant = currentTenant();
    const sharedUuid = consumeInvite(req.params.token);
    if (!sharedUuid) {
      res.status(410).json({ success: false, error: 'Einladung ungültig oder abgelaufen / Invite invalid or expired' });
      return;
    }

    const sa = getSharedAccount(sharedUuid);
    if (!sa) {
      res.status(404).json({ success: false, error: 'Geteiltes Konto nicht gefunden / Shared account not found' });
      return;
    }

    // Cannot join your own account
    if (sa.ownerTenant === tenant) {
      res.status(400).json({ success: false, error: 'Du bist der Eigentümer dieses Kontos / You are the owner of this account' });
      return;
    }

    addMember(sharedUuid, tenant, tenant);

    res.json({ success: true, data: { sharedUuid } });
  } catch (err) {
    console.error('POST /shared-accounts/join/:token error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /shared-accounts/:uuid — get shared account details
sharedAccountsRouter.get('/:uuid', async (req, res) => {
  try {
    const tenant = currentTenant();
    const { uuid } = req.params;

    const role = isMemberOrOwner(uuid, tenant);
    if (!role) {
      res.status(403).json({ success: false, error: 'Kein Zugriff / Access denied' });
      return;
    }

    const sa = getSharedAccount(uuid)!;
    const accountData = await inOwnerDb(sa.ownerTenant, () =>
      db.prepare(`
        SELECT name, initial_balance + COALESCE(
          (SELECT SUM(CASE WHEN t.type='income' THEN t.amount WHEN t.type='expense' THEN -t.amount WHEN t.type='transfer' AND t.account_id=a.id THEN -t.amount WHEN t.type='transfer' AND t.transfer_to_account_id=a.id THEN t.amount ELSE 0 END)
           FROM transactions t WHERE t.account_id=a.id OR t.transfer_to_account_id=a.id), 0
        ) as balance FROM accounts a WHERE a.id=?
      `).get(sa.accountId) as { name: string; balance: number } | undefined
    );

    const result: SharedAccountInfo = {
      uuid: sa.uuid,
      ownerTenant: sa.ownerTenant,
      accountId: sa.accountId,
      accountName: accountData?.name ?? '(unbekannt)',
      balance: accountData?.balance ?? 0,
      createdAt: sa.createdAt,
      members: sa.members.map(m => ({ tenant: m.memberTenant, displayName: m.displayName, joinedAt: m.joinedAt })),
      isOwner: role === 'owner',
      mode: sa.mode,
    };

    res.json({ success: true, data: result });
  } catch (err) {
    console.error('GET /shared-accounts/:uuid error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /shared-accounts/:uuid/invite — generate invite link (owner only)
sharedAccountsRouter.post('/:uuid/invite', (req, res) => {
  try {
    const tenant = currentTenant();
    const { uuid } = req.params;

    const sa = getSharedAccount(uuid);
    if (!sa) {
      res.status(404).json({ success: false, error: 'Geteiltes Konto nicht gefunden' });
      return;
    }
    if (sa.ownerTenant !== tenant) {
      res.status(403).json({ success: false, error: 'Nur der Eigentümer kann Einladungen erstellen / Owner only' });
      return;
    }

    const durationHours = typeof req.body?.durationHours === 'number' && req.body.durationHours >= 0
      ? req.body.durationHours
      : 48;
    const token = createInvite(uuid, durationHours);
    const invite = getInviteByToken(token)!;

    res.json({ success: true, data: { token, sharedUuid: uuid, expiresAt: invite.expiresAt } });
  } catch (err) {
    console.error('POST /shared-accounts/:uuid/invite error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// DELETE /shared-accounts/:uuid — stop sharing (owner only)
sharedAccountsRouter.delete('/:uuid', async (req, res) => {
  try {
    const tenant = currentTenant();
    const { uuid } = req.params;

    const sa = getSharedAccount(uuid);
    if (!sa) {
      res.status(404).json({ success: false, error: 'Geteiltes Konto nicht gefunden' });
      return;
    }
    if (sa.ownerTenant !== tenant) {
      res.status(403).json({ success: false, error: 'Nur der Eigentümer kann das Teilen beenden / Owner only' });
      return;
    }

    // Clear shared_uuid from account in owner's DB
    await inOwnerDb(tenant, () => {
      db.prepare('UPDATE accounts SET shared_uuid = NULL WHERE id = ?').run(sa.accountId);
    });

    deleteSharedAccount(uuid);

    res.json({ success: true, data: { success: true } });
  } catch (err) {
    console.error('DELETE /shared-accounts/:uuid error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// DELETE /shared-accounts/:uuid/members/:memberTenant — remove member (owner only)
sharedAccountsRouter.delete('/:uuid/members/:memberTenant', (req, res) => {
  try {
    const tenant = currentTenant();
    const { uuid, memberTenant } = req.params;

    const sa = getSharedAccount(uuid);
    if (!sa) {
      res.status(404).json({ success: false, error: 'Geteiltes Konto nicht gefunden' });
      return;
    }
    if (sa.ownerTenant !== tenant && memberTenant !== tenant) {
      res.status(403).json({ success: false, error: 'Nur der Eigentümer kann Mitglieder entfernen / Owner only' });
      return;
    }

    removeMember(uuid, memberTenant);

    res.json({ success: true, data: { success: true } });
  } catch (err) {
    console.error('DELETE /shared-accounts/:uuid/members/:memberTenant error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /shared-accounts/:uuid/transactions — get transactions from owner's DB
sharedAccountsRouter.get('/:uuid/transactions', async (req, res) => {
  try {
    const tenant = currentTenant();
    const { uuid } = req.params;

    const role = isMemberOrOwner(uuid, tenant);
    if (!role) {
      res.status(403).json({ success: false, error: 'Kein Zugriff / Access denied' });
      return;
    }

    const sa = getSharedAccount(uuid)!;

    const [transactions, splitRows] = await inOwnerDb(sa.ownerTenant, () => {
      const txs = db.prepare(`
        SELECT
          t.*,
          a.name as account_name,
          c.name as category_name,
          c.color as category_color,
          pc.name as parent_category_name,
          ta.name as transfer_to_account_name
        FROM transactions t
        JOIN accounts a ON t.account_id = a.id
        LEFT JOIN categories c ON t.category_id = c.id
        LEFT JOIN categories pc ON c.parent_id = pc.id
        LEFT JOIN accounts ta ON t.transfer_to_account_id = ta.id
        WHERE t.account_id = ?
        ORDER BY t.date DESC, t.id DESC
      `).all(sa.accountId) as any[];

      const splits = db.prepare(`
        SELECT ss.id as split_id, ss.transaction_id, ss.split_type,
               sss.tenant, sss.amount, sss.settled
        FROM shared_splits ss
        JOIN shared_split_shares sss ON sss.split_id = ss.id
        WHERE ss.shared_uuid = ?
      `).all(uuid) as any[];

      return [txs, splits];
    });

    // Group split shares by transaction_id
    const splitMap: Record<number, TransactionSplit> = {};
    for (const s of splitRows) {
      if (!splitMap[s.transaction_id]) {
        splitMap[s.transaction_id] = { splitId: s.split_id, splitType: s.split_type, shares: [] };
      }
      splitMap[s.transaction_id].shares.push({ tenant: s.tenant, amount: s.amount, settled: s.settled === 1 });
    }

    const mapped: TransactionWithDetails[] = transactions.map(t => ({
      id: t.id,
      accountId: t.account_id,
      categoryId: t.category_id ?? undefined,
      amount: t.amount,
      type: t.type,
      description: t.description ?? undefined,
      date: t.date,
      notes: t.notes ?? undefined,
      transferToAccountId: t.transfer_to_account_id ?? undefined,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
      accountName: t.account_name,
      categoryName: t.category_name ?? undefined,
      categoryColor: t.category_color ?? undefined,
      parentCategoryName: t.parent_category_name ?? undefined,
      transferToAccountName: t.transfer_to_account_name ?? undefined,
      addedBy: t.added_by ?? sa.ownerTenant,
      split: splitMap[t.id],
    }));

    res.json({ success: true, data: mapped });
  } catch (err) {
    console.error('GET /shared-accounts/:uuid/transactions error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /shared-accounts/:uuid/transactions — add transaction to owner's DB
sharedAccountsRouter.post('/:uuid/transactions', async (req, res) => {
  try {
    const tenant = currentTenant();
    const { uuid } = req.params;

    const role = isMemberOrOwner(uuid, tenant);
    if (!role) {
      res.status(403).json({ success: false, error: 'Kein Zugriff / Access denied' });
      return;
    }

    const sa = getSharedAccount(uuid)!;
    const { categoryId, amount, type, description, date, notes } = req.body;

    if (!amount || !type || !date) {
      res.status(400).json({ success: false, error: 'Betrag, Typ und Datum sind erforderlich' });
      return;
    }

    const result = await inOwnerDb(sa.ownerTenant, () =>
      db.prepare(`
        INSERT INTO transactions (account_id, category_id, amount, type, description, date, notes, added_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        sa.accountId,
        categoryId ?? null,
        amount,
        type,
        description ?? null,
        date,
        notes ?? null,
        tenant
      )
    );

    const newTx = await inOwnerDb(sa.ownerTenant, () =>
      db.prepare('SELECT * FROM transactions WHERE id = ?').get(result.lastInsertRowid) as any
    );

    res.status(201).json({ success: true, data: newTx });
  } catch (err) {
    console.error('POST /shared-accounts/:uuid/transactions error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// DELETE /shared-accounts/:uuid/transactions/:txId — delete a transaction (must be added by current tenant or owner)
sharedAccountsRouter.delete('/:uuid/transactions/:txId', async (req, res) => {
  try {
    const tenant = currentTenant();
    const { uuid, txId } = req.params;

    const role = isMemberOrOwner(uuid, tenant);
    if (!role) {
      res.status(403).json({ success: false, error: 'Kein Zugriff / Access denied' });
      return;
    }

    const sa = getSharedAccount(uuid)!;

    const tx = await inOwnerDb(sa.ownerTenant, () =>
      db.prepare('SELECT * FROM transactions WHERE id = ? AND account_id = ?').get(txId, sa.accountId) as any
    );

    if (!tx) {
      res.status(404).json({ success: false, error: 'Transaktion nicht gefunden' });
      return;
    }

    // Only the adder or owner can delete
    if (tx.added_by !== tenant && sa.ownerTenant !== tenant) {
      res.status(403).json({ success: false, error: 'Nur der Ersteller oder Eigentümer kann löschen' });
      return;
    }

    await inOwnerDb(sa.ownerTenant, () => {
      // Clean up payer income tx before deleting the expense (CASCADE removes shared_splits)
      const split = db.prepare('SELECT payer_settlement_tx_id FROM shared_splits WHERE transaction_id = ?').get(txId) as { payer_settlement_tx_id: number | null } | undefined;
      if (split?.payer_settlement_tx_id) {
        db.prepare('DELETE FROM transactions WHERE id = ?').run(split.payer_settlement_tx_id);
      }
      db.prepare('DELETE FROM transactions WHERE id = ?').run(txId);
    });

    res.json({ success: true, data: { success: true } });
  } catch (err) {
    console.error('DELETE /shared-accounts/:uuid/transactions/:txId error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /shared-accounts/:uuid/transactions/:txId/split — create or update split
sharedAccountsRouter.post('/:uuid/transactions/:txId/split', async (req, res) => {
  try {
    const tenant = currentTenant();
    const { uuid, txId } = req.params;
    const { type = 'custom', shares } = req.body;

    const role = isMemberOrOwner(uuid, tenant);
    if (!role) {
      res.status(403).json({ success: false, error: 'Kein Zugriff / Access denied' });
      return;
    }

    const sa = getSharedAccount(uuid)!;
    const allMembers = [sa.ownerTenant, ...sa.members.map(m => m.memberTenant)];

    const tx = await inOwnerDb(sa.ownerTenant, () =>
      db.prepare('SELECT * FROM transactions WHERE id = ? AND account_id = ?').get(txId, sa.accountId) as any
    );

    if (!tx) {
      res.status(404).json({ success: false, error: 'Transaktion nicht gefunden' });
      return;
    }

    const payer = tx.added_by ?? sa.ownerTenant;

    await inOwnerDb(sa.ownerTenant, () => {
      // Check for existing split
      const existing = db.prepare(
        'SELECT id, payer_settlement_tx_id FROM shared_splits WHERE transaction_id = ?'
      ).get(txId) as { id: number; payer_settlement_tx_id: number | null } | undefined;

      // Collect already-settled non-payer shares (locked — cannot change)
      const settledNonPayer: Record<string, number> = {};
      let splitId: number | bigint;

      if (existing) {
        const settledRows = db.prepare(
          'SELECT tenant, amount FROM shared_split_shares WHERE split_id = ? AND settled = 1 AND tenant != ?'
        ).all(existing.id, payer) as { tenant: string; amount: number }[];
        settledRows.forEach(r => { settledNonPayer[r.tenant] = r.amount; });

        // Delete old payer income tx (will be re-created below)
        if (existing.payer_settlement_tx_id) {
          db.prepare('DELETE FROM transactions WHERE id = ?').run(existing.payer_settlement_tx_id);
        }

        // Remove unsettled shares + payer's share (payer is always recomputed)
        db.prepare('DELETE FROM shared_split_shares WHERE split_id = ? AND (settled = 0 OR tenant = ?)').run(existing.id, payer);
        db.prepare('UPDATE shared_splits SET split_type = ?, payer_settlement_tx_id = NULL WHERE id = ?').run(type, existing.id);
        splitId = existing.id;
      } else {
        const result = db.prepare(
          'INSERT INTO shared_splits (transaction_id, shared_uuid, split_type) VALUES (?, ?, ?)'
        ).run(txId, uuid, type);
        splitId = result.lastInsertRowid;
      }

      // Insert new shares for non-payer members (skip already-settled locked ones)
      let sumOthers = Object.values(settledNonPayer).reduce((a, b) => a + b, 0);

      if (type === 'equal') {
        const perPerson = Math.round((tx.amount / allMembers.length) * 100) / 100;
        for (const t of allMembers) {
          if (t === payer || settledNonPayer[t] !== undefined) continue;
          db.prepare('INSERT INTO shared_split_shares (split_id, tenant, amount) VALUES (?, ?, ?)').run(splitId, t, perPerson);
          sumOthers += perPerson;
        }
      } else if (shares) {
        for (const t of allMembers) {
          if (t === payer || settledNonPayer[t] !== undefined) continue;
          const amount = Number((shares as Record<string, number>)[t]) || 0;
          db.prepare('INSERT INTO shared_split_shares (split_id, tenant, amount) VALUES (?, ?, ?)').run(splitId, t, amount);
          sumOthers += amount;
        }
      }

      // Payer gets the residual
      const payerAmount = Math.max(0, Math.round((tx.amount - sumOthers) * 100) / 100);
      db.prepare('INSERT INTO shared_split_shares (split_id, tenant, amount) VALUES (?, ?, ?)').run(splitId, payer, payerAmount);
      db.prepare('UPDATE shared_split_shares SET settled = 1 WHERE split_id = ? AND tenant = ?').run(splitId, payer);

      // Create payer income tx so account balance reaches 0 when all settle
      const desc = tx.description ? `Eigenanteil: ${tx.description}` : 'Eigenanteil / Own share';
      const payerTxResult = db.prepare(`
        INSERT INTO transactions (account_id, amount, type, description, date, added_by)
        VALUES (?, ?, 'income', ?, ?, ?)
      `).run(sa.accountId, payerAmount, desc, tx.date, payer);

      db.prepare('UPDATE shared_splits SET payer_settlement_tx_id = ? WHERE id = ?').run(
        payerTxResult.lastInsertRowid, splitId
      );
    });

    res.json({ success: true, data: { success: true } });
  } catch (err) {
    console.error('POST /shared-accounts/:uuid/transactions/:txId/split error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// PATCH /shared-accounts/:uuid/transactions/:txId/split/share — toggle settled status for a share
sharedAccountsRouter.patch('/:uuid/transactions/:txId/split/share', async (req, res) => {
  try {
    const tenant = currentTenant();
    const { uuid, txId } = req.params;
    const { tenant: targetTenant, settled } = req.body;

    const role = isMemberOrOwner(uuid, tenant);
    if (!role) {
      res.status(403).json({ success: false, error: 'Kein Zugriff / Access denied' });
      return;
    }

    const sa = getSharedAccount(uuid)!;

    await inOwnerDb(sa.ownerTenant, () => {
      const split = db.prepare('SELECT id FROM shared_splits WHERE transaction_id = ? AND shared_uuid = ?').get(txId, uuid) as { id: number } | undefined;
      if (!split) return;
      db.prepare('UPDATE shared_split_shares SET settled = ? WHERE split_id = ? AND tenant = ?')
        .run(settled ? 1 : 0, split.id, targetTenant ?? tenant);
    });

    res.json({ success: true, data: { success: true } });
  } catch (err) {
    console.error('PATCH /shared-accounts/:uuid/transactions/:txId/split/share error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /shared-accounts/:uuid/balance — calculate who owes whom (payer-aware, with netting)
sharedAccountsRouter.get('/:uuid/balance', async (req, res) => {
  try {
    const tenant = currentTenant();
    const { uuid } = req.params;

    const role = isMemberOrOwner(uuid, tenant);
    if (!role) {
      res.status(403).json({ success: false, error: 'Kein Zugriff / Access denied' });
      return;
    }

    const sa = getSharedAccount(uuid)!;
    const allMembers = [sa.ownerTenant, ...sa.members.map(m => m.memberTenant)];

    // Find all shared accounts where ≥2 of our members participate (for cross-pool netting)
    const memberSharedUuids: Record<string, Set<string>> = {};
    for (const m of allMembers) {
      const s = new Set<string>();
      getOwnerSharedAccounts(m).forEach(x => s.add(x.uuid));
      getMemberSharedAccounts(m).forEach(x => s.add(x.uuid));
      memberSharedUuids[m] = s;
    }
    const uuidCount: Record<string, number> = {};
    for (const m of allMembers) {
      for (const u of memberSharedUuids[m]) {
        uuidCount[u] = (uuidCount[u] ?? 0) + 1;
      }
    }
    const relevantUuids = Object.keys(uuidCount).filter(u => uuidCount[u] >= 2);

    // rawDebts[debtor][creditor] = amount
    const rawDebts: Record<string, Record<string, number>> = {};
    // rawSources[debtor][creditor] = list of source transactions
    const rawSources: Record<string, Record<string, { description?: string; amount: number }[]>> = {};

    function addDebt(debtor: string, creditor: string, amount: number, source?: { description?: string; amount: number }) {
      if (debtor === creditor || amount <= 0) return;
      if (!rawDebts[debtor]) rawDebts[debtor] = {};
      rawDebts[debtor][creditor] = (rawDebts[debtor][creditor] ?? 0) + amount;
      if (source) {
        if (!rawSources[debtor]) rawSources[debtor] = {};
        if (!rawSources[debtor][creditor]) rawSources[debtor][creditor] = [];
        rawSources[debtor][creditor].push(source);
      }
    }

    // Collect splits from all relevant shared accounts
    for (const sharedUuid of relevantUuids) {
      const sharedAcct = getSharedAccount(sharedUuid);
      if (!sharedAcct) continue;

      const splits = await inOwnerDb(sharedAcct.ownerTenant, () =>
        db.prepare(`
          SELECT sss.tenant, sss.amount, COALESCE(t.added_by, ?) as payer, t.description
          FROM shared_split_shares sss
          JOIN shared_splits ss ON sss.split_id = ss.id
          JOIN transactions t ON ss.transaction_id = t.id
          WHERE ss.shared_uuid = ? AND sss.settled = 0
        `).all(sharedAcct.ownerTenant, sharedUuid) as { tenant: string; amount: number; payer: string; description: string | null }[]
      );

      for (const row of splits) {
        // Only count debts between members of the CURRENT shared account
        if (!allMembers.includes(row.tenant) || !allMembers.includes(row.payer)) continue;
        if (row.tenant !== row.payer) {
          addDebt(row.tenant, row.payer, row.amount, {
            description: row.description ?? undefined,
            amount: row.amount,
          });
        }
      }
    }

    // Net mutual debts for each pair of members
    for (let i = 0; i < allMembers.length; i++) {
      for (let j = i + 1; j < allMembers.length; j++) {
        const a = allMembers[i], b = allMembers[j];
        const aOwesB = rawDebts[a]?.[b] ?? 0;
        const bOwesA = rawDebts[b]?.[a] ?? 0;
        const net = Math.round((aOwesB - bOwesA) * 100) / 100;
        if (net >= 0) {
          if (net > 0) { if (!rawDebts[a]) rawDebts[a] = {}; rawDebts[a][b] = net; }
          else if (rawDebts[a]) delete rawDebts[a][b];
          if (rawDebts[b]) delete rawDebts[b][a];
        } else {
          const pos = Math.round(-net * 100) / 100;
          if (!rawDebts[b]) rawDebts[b] = {};
          rawDebts[b][a] = pos;
          if (rawDebts[a]) delete rawDebts[a][b];
        }
      }
    }

    // Express from requesting tenant's perspective
    const balances: SharedBalance[] = [];
    let totalUnsettled = 0;
    for (const otherTenant of allMembers) {
      if (otherTenant === tenant) continue;
      const otherOwesMe = rawDebts[otherTenant]?.[tenant] ?? 0;
      const iOweThem = rawDebts[tenant]?.[otherTenant] ?? 0;
      const net = Math.round((otherOwesMe - iOweThem) * 100) / 100;
      if (net === 0) continue;
      // Sources: whose debt is larger determines which sources to show
      const sources = net > 0
        ? (rawSources[otherTenant]?.[tenant] ?? [])
        : (rawSources[tenant]?.[otherTenant] ?? []);
      const member = sa.members.find(m => m.memberTenant === otherTenant);
      balances.push({ tenant: otherTenant, displayName: member?.displayName ?? null, owes: net, sources });
      totalUnsettled += Math.abs(net);
    }

    const result: SharedBalanceResult = {
      balances,
      totalUnsettled: Math.round(totalUnsettled * 100) / 100,
    };

    res.json({ success: true, data: result });
  } catch (err) {
    console.error('GET /shared-accounts/:uuid/balance error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /shared-accounts/:uuid/settle — settle up (create settlement transaction + mark splits settled)
sharedAccountsRouter.post('/:uuid/settle', async (req, res) => {
  try {
    const tenant = currentTenant();
    const { uuid } = req.params;

    const role = isMemberOrOwner(uuid, tenant);
    if (!role) {
      res.status(403).json({ success: false, error: 'Kein Zugriff / Access denied' });
      return;
    }

    const sa = getSharedAccount(uuid)!;
    const { amount, date, settlingTenant, fromAccountId, categoryId } = req.body;

    // Only owner or the settling tenant can call this
    const targetTenant = settlingTenant ?? tenant;
    const settleDate = date ?? new Date().toISOString().slice(0, 10);
    const settleAmount = amount ?? 0;

    await inOwnerDb(sa.ownerTenant, () => {
      // Mark all split shares for this tenant as settled
      const splitIds = db.prepare(`
        SELECT ss.id FROM shared_splits ss WHERE ss.shared_uuid = ?
      `).all(uuid) as { id: number }[];

      for (const split of splitIds) {
        db.prepare('UPDATE shared_split_shares SET settled = 1 WHERE split_id = ? AND tenant = ?').run(split.id, targetTenant);
      }

      // Create a settlement income transaction in the shared account
      db.prepare(`
        INSERT INTO transactions (account_id, amount, type, description, date, added_by)
        VALUES (?, ?, 'income', ?, ?, ?)
      `).run(
        sa.accountId,
        settleAmount,
        `Schuldenausgleich / Settlement (${targetTenant})`,
        settleDate,
        tenant
      );
    });

    // Optionally create expense on settling tenant's own account (Umbuchung)
    if (fromAccountId) {
      await inOwnerDb(targetTenant, () => {
        db.prepare(`
          INSERT INTO transactions (account_id, amount, type, description, date, category_id, added_by)
          VALUES (?, ?, 'expense', ?, ?, ?, ?)
        `).run(
          fromAccountId,
          settleAmount,
          `Schuldenausgleich / Settlement`,
          settleDate,
          categoryId ?? null,
          targetTenant
        );
      });
    }

    res.json({ success: true, data: { success: true } });
  } catch (err) {
    console.error('POST /shared-accounts/:uuid/settle error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});
