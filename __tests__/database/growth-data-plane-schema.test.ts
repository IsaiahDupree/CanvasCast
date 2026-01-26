/**
 * GDP-001: Supabase Schema Setup
 * Test suite for Growth Data Plane database schema
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

describe('GDP-001: Growth Data Plane Schema', () => {
  describe('person table', () => {
    it('should have person table created', async () => {
      const { data, error } = await supabase
        .from('person')
        .select('*')
        .limit(0);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should have required columns in person table', async () => {
      const { data: columns } = await supabase
        .rpc('get_table_columns', { table_name: 'person' })
        .select('column_name');

      const columnNames = columns?.map((c: any) => c.column_name) || [];

      expect(columnNames).toContain('id');
      expect(columnNames).toContain('email');
      expect(columnNames).toContain('first_name');
      expect(columnNames).toContain('last_name');
      expect(columnNames).toContain('created_at');
      expect(columnNames).toContain('updated_at');
    });
  });

  describe('identity_link table', () => {
    it('should have identity_link table created', async () => {
      const { data, error } = await supabase
        .from('identity_link')
        .select('*')
        .limit(0);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should have required columns in identity_link table', async () => {
      const { data: columns } = await supabase
        .rpc('get_table_columns', { table_name: 'identity_link' })
        .select('column_name');

      const columnNames = columns?.map((c: any) => c.column_name) || [];

      expect(columnNames).toContain('id');
      expect(columnNames).toContain('person_id');
      expect(columnNames).toContain('source');
      expect(columnNames).toContain('external_id');
      expect(columnNames).toContain('created_at');
    });
  });

  describe('event table', () => {
    it('should have event table created', async () => {
      const { data, error } = await supabase
        .from('event')
        .select('*')
        .limit(0);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should have required columns in event table', async () => {
      const { data: columns } = await supabase
        .rpc('get_table_columns', { table_name: 'event' })
        .select('column_name');

      const columnNames = columns?.map((c: any) => c.column_name) || [];

      expect(columnNames).toContain('id');
      expect(columnNames).toContain('person_id');
      expect(columnNames).toContain('event_name');
      expect(columnNames).toContain('event_source');
      expect(columnNames).toContain('properties');
      expect(columnNames).toContain('occurred_at');
      expect(columnNames).toContain('created_at');
    });
  });

  describe('email_message table', () => {
    it('should have email_message table created', async () => {
      const { data, error } = await supabase
        .from('email_message')
        .select('*')
        .limit(0);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should have required columns in email_message table', async () => {
      const { data: columns } = await supabase
        .rpc('get_table_columns', { table_name: 'email_message' })
        .select('column_name');

      const columnNames = columns?.map((c: any) => c.column_name) || [];

      expect(columnNames).toContain('id');
      expect(columnNames).toContain('person_id');
      expect(columnNames).toContain('resend_email_id');
      expect(columnNames).toContain('subject');
      expect(columnNames).toContain('sent_at');
      expect(columnNames).toContain('created_at');
    });
  });

  describe('email_event table', () => {
    it('should have email_event table created', async () => {
      const { data, error } = await supabase
        .from('email_event')
        .select('*')
        .limit(0);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should have required columns in email_event table', async () => {
      const { data: columns } = await supabase
        .rpc('get_table_columns', { table_name: 'email_event' })
        .select('column_name');

      const columnNames = columns?.map((c: any) => c.column_name) || [];

      expect(columnNames).toContain('id');
      expect(columnNames).toContain('email_message_id');
      expect(columnNames).toContain('event_type');
      expect(columnNames).toContain('occurred_at');
      expect(columnNames).toContain('created_at');
    });
  });

  describe('subscription table', () => {
    it('should have subscription table created', async () => {
      const { data, error } = await supabase
        .from('subscription')
        .select('*')
        .limit(0);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should have required columns in subscription table', async () => {
      const { data: columns } = await supabase
        .rpc('get_table_columns', { table_name: 'subscription' })
        .select('column_name');

      const columnNames = columns?.map((c: any) => c.column_name) || [];

      expect(columnNames).toContain('id');
      expect(columnNames).toContain('person_id');
      expect(columnNames).toContain('stripe_subscription_id');
      expect(columnNames).toContain('status');
      expect(columnNames).toContain('plan_name');
      expect(columnNames).toContain('mrr');
      expect(columnNames).toContain('created_at');
      expect(columnNames).toContain('updated_at');
    });
  });

  describe('deal table', () => {
    it('should have deal table created', async () => {
      const { data, error } = await supabase
        .from('deal')
        .select('*')
        .limit(0);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should have required columns in deal table', async () => {
      const { data: columns } = await supabase
        .rpc('get_table_columns', { table_name: 'deal' })
        .select('column_name');

      const columnNames = columns?.map((c: any) => c.column_name) || [];

      expect(columnNames).toContain('id');
      expect(columnNames).toContain('person_id');
      expect(columnNames).toContain('stage');
      expect(columnNames).toContain('value');
      expect(columnNames).toContain('created_at');
      expect(columnNames).toContain('updated_at');
    });
  });

  describe('person_features table', () => {
    it('should have person_features table created', async () => {
      const { data, error } = await supabase
        .from('person_features')
        .select('*')
        .limit(0);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should have required columns in person_features table', async () => {
      const { data: columns } = await supabase
        .rpc('get_table_columns', { table_name: 'person_features' })
        .select('column_name');

      const columnNames = columns?.map((c: any) => c.column_name) || [];

      expect(columnNames).toContain('id');
      expect(columnNames).toContain('person_id');
      expect(columnNames).toContain('active_days');
      expect(columnNames).toContain('core_actions');
      expect(columnNames).toContain('pricing_views');
      expect(columnNames).toContain('email_opens');
      expect(columnNames).toContain('computed_at');
    });
  });

  describe('segment table', () => {
    it('should have segment table created', async () => {
      const { data, error } = await supabase
        .from('segment')
        .select('*')
        .limit(0);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should have required columns in segment table', async () => {
      const { data: columns } = await supabase
        .rpc('get_table_columns', { table_name: 'segment' })
        .select('column_name');

      const columnNames = columns?.map((c: any) => c.column_name) || [];

      expect(columnNames).toContain('id');
      expect(columnNames).toContain('name');
      expect(columnNames).toContain('description');
      expect(columnNames).toContain('conditions');
      expect(columnNames).toContain('created_at');
      expect(columnNames).toContain('updated_at');
    });
  });

  describe('Database helper function', () => {
    it('should have get_table_columns RPC function', async () => {
      const { data, error } = await supabase
        .rpc('get_table_columns', { table_name: 'person' });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
    });
  });
});
