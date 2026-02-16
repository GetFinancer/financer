import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { tenantStorage } from '../db/index.js';
import { getTenantStatus, updateTenantStatus, updateTenantStripe, getDiscountCouponForTenant } from '../db/registry.js';
import { authMiddleware } from '../middleware/auth.js';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

export const billingRouter = Router();

function requireStripe(res: Response): res is Response {
  if (!stripe) {
    res.status(503).json({ success: false, error: 'Billing is not configured.' });
    return false;
  }
  return true;
}

// Create Stripe Checkout Session
billingRouter.post('/checkout', authMiddleware, async (req, res) => {
  if (!requireStripe(res)) return;

  const tenant = tenantStorage.getStore();
  if (!tenant) {
    res.status(500).json({ success: false, error: 'No tenant context' });
    return;
  }

  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId) {
    res.status(503).json({ success: false, error: 'Stripe price not configured.' });
    return;
  }

  const baseDomain = process.env.BASE_DOMAIN || 'getfinancer.com';
  const tenantUrl = `https://${tenant}.${baseDomain}`;

  try {
    // Check if tenant already has a Stripe customer
    const registryEntry = getTenantStatus(tenant);
    let customerId = registryEntry?.stripeCustomerId || undefined;

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      payment_method_types: ['card', 'sepa_debit'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${tenantUrl}/settings?billing=success`,
      cancel_url: `${tenantUrl}/settings?billing=cancelled`,
      metadata: { tenant },
    };

    if (customerId) {
      sessionParams.customer = customerId;
    } else {
      sessionParams.customer_creation = 'always';
    }

    // Apply discount coupon if tenant has redeemed one
    const stripeCouponId = getDiscountCouponForTenant(tenant);
    if (stripeCouponId) {
      sessionParams.discounts = [{ coupon: stripeCouponId }];
    }

    const session = await stripe!.checkout.sessions.create(sessionParams);

    res.json({
      success: true,
      data: { url: session.url },
    });
  } catch (error: any) {
    console.error('Failed to create checkout session:', error);
    res.status(500).json({ success: false, error: 'Failed to create checkout session.' });
  }
});

// Get billing status
billingRouter.get('/status', authMiddleware, (req, res) => {
  const tenant = tenantStorage.getStore();
  if (!tenant) {
    res.status(500).json({ success: false, error: 'No tenant context' });
    return;
  }

  const registryEntry = getTenantStatus(tenant);

  if (!registryEntry) {
    // Legacy tenant
    res.json({
      success: true,
      data: { status: 'active', hasSubscription: true, legacy: true },
    });
    return;
  }

  res.json({
    success: true,
    data: {
      status: registryEntry.status,
      hasSubscription: !!registryEntry.stripeSubscriptionId,
    },
  });
});

// Create Stripe Customer Portal session
billingRouter.post('/portal', authMiddleware, async (req, res) => {
  if (!requireStripe(res)) return;

  const tenant = tenantStorage.getStore();
  if (!tenant) {
    res.status(500).json({ success: false, error: 'No tenant context' });
    return;
  }

  const registryEntry = getTenantStatus(tenant);
  if (!registryEntry?.stripeCustomerId) {
    res.status(400).json({ success: false, error: 'No billing account found.' });
    return;
  }

  const baseDomain = process.env.BASE_DOMAIN || 'getfinancer.com';

  try {
    const session = await stripe!.billingPortal.sessions.create({
      customer: registryEntry.stripeCustomerId,
      return_url: `https://${tenant}.${baseDomain}/settings`,
    });

    res.json({
      success: true,
      data: { url: session.url },
    });
  } catch (error: any) {
    console.error('Failed to create portal session:', error);
    res.status(500).json({ success: false, error: 'Failed to create portal session.' });
  }
});

// Stripe Webhook handler (raw body required — mounted separately in app.ts)
export async function billingWebhookHandler(req: Request, res: Response) {
  if (!stripe) {
    res.status(503).send('Billing not configured');
    return;
  }

  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    res.status(503).send('Webhook secret not configured');
    return;
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const tenant = session.metadata?.tenant;
        if (tenant && session.customer && session.subscription) {
          updateTenantStripe(
            tenant,
            session.customer as string,
            session.subscription as string
          );
          console.log(`Tenant ${tenant} activated via Stripe checkout`);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const tenant = subscription.metadata?.tenant;
        if (tenant) {
          updateTenantStatus(tenant, 'cancelled');
          console.log(`Tenant ${tenant} subscription cancelled`);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const tenant = (invoice as any).subscription_details?.metadata?.tenant;
        if (tenant) {
          updateTenantStatus(tenant, 'expired');
          console.log(`Tenant ${tenant} payment failed`);
        }
        break;
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
}
