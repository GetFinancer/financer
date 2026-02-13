import { Router } from 'express';
import { db } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';
import type { Category, CreateCategoryRequest } from '@financer/shared';

export const categoriesRouter = Router();

categoriesRouter.use(authMiddleware);

// Get all categories
categoriesRouter.get('/', (_req, res) => {
  const categories = db.prepare(`
    SELECT * FROM categories ORDER BY type, name
  `).all() as any[];

  const mapped: Category[] = categories.map(c => ({
    id: c.id,
    name: c.name,
    type: c.type,
    color: c.color ?? undefined,
    icon: c.icon ?? undefined,
    parentId: c.parent_id ?? undefined,
    createdAt: c.created_at,
  }));

  res.json({ success: true, data: mapped });
});

// Get single category
categoriesRouter.get('/:id', (req, res) => {
  const { id } = req.params;

  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as any;

  if (!category) {
    res.status(404).json({ success: false, error: 'Kategorie nicht gefunden' });
    return;
  }

  const mapped: Category = {
    id: category.id,
    name: category.name,
    type: category.type,
    color: category.color ?? undefined,
    icon: category.icon ?? undefined,
    parentId: category.parent_id ?? undefined,
    createdAt: category.created_at,
  };

  res.json({ success: true, data: mapped });
});

// Create category
categoriesRouter.post('/', (req, res) => {
  const { name, type, color, icon, parentId } = req.body as CreateCategoryRequest;

  if (!name || !type) {
    res.status(400).json({ success: false, error: 'Name und Typ sind erforderlich' });
    return;
  }

  if (!['income', 'expense'].includes(type)) {
    res.status(400).json({ success: false, error: 'Ungültiger Kategorietyp' });
    return;
  }

  const result = db.prepare(`
    INSERT INTO categories (name, type, color, icon, parent_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(name, type, color || null, icon || null, parentId || null);

  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);

  res.status(201).json({ success: true, data: category });
});

// Update category
categoriesRouter.put('/:id', (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, type, color, icon, parentId } = req.body;

    const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Kategorie nicht gefunden' });
      return;
    }

    // Convert undefined to null for sql.js compatibility
    db.prepare(`
      UPDATE categories
      SET name = COALESCE(?, name),
          type = COALESCE(?, type),
          color = ?,
          icon = ?,
          parent_id = ?
      WHERE id = ?
    `).run(
      name ?? null,
      type ?? null,
      color ?? null,
      icon ?? null,
      parentId ?? null,
      id
    );

    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);

    res.json({ success: true, data: category });
  } catch (err) {
    console.error('Update category error:', err);
    next(err);
  }
});

// Delete category
categoriesRouter.delete('/:id', (req, res) => {
  const { id } = req.params;

  const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
  if (!existing) {
    res.status(404).json({ success: false, error: 'Kategorie nicht gefunden' });
    return;
  }

  // Check for transactions
  const transactionCount = db.prepare(
    'SELECT COUNT(*) as count FROM transactions WHERE category_id = ?'
  ).get(id) as { count: number };

  if (transactionCount.count > 0) {
    res.status(400).json({
      success: false,
      error: 'Kategorie kann nicht gelöscht werden, da noch Transaktionen vorhanden sind',
    });
    return;
  }

  db.prepare('DELETE FROM categories WHERE id = ?').run(id);

  res.json({ success: true, data: { success: true } });
});
