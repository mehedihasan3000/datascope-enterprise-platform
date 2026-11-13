import { ROLE_CAPABILITIES, ROLES } from '@datascope/shared';
import bcrypt from 'bcryptjs';
import { pool } from '../index.js';
import { runMigrations } from '../migrate.js';

export async function seedDatabase(): Promise<void> {
  const overallStart = performance.now();
  console.log('🌱 Starting DataScope Enterprise Cloud PostgreSQL Seeder (100,000+ Records)...');

  // Ensure schema and extensions exist first
  await runMigrations();

  const client = await pool.connect();

  try {
    // Check if primary dataset already has >= 100,000 records
    const existingCountRes = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM dataset_records`
    );
    const existingCount = Number.parseInt(existingCountRes.rows[0]?.count ?? '0', 10);

    if (existingCount >= 100_000) {
      console.log(
        `✅ Database already seeded with ${existingCount.toLocaleString()} records. Skipping bulk re-seed.`
      );
      return;
    }

    console.log('🧹 Cleaning partial seed data before deterministic 100,000+ record generation...');
    await client.query('BEGIN');

    await client.query(`
      TRUNCATE TABLE
        search_history,
        saved_views,
        record_history,
        record_relationships,
        dataset_records,
        access_permissions,
        dataset_fields,
        datasets,
        user_preferences,
        users,
        roles
      RESTART IDENTITY CASCADE;
    `);

    // 1. Seed Roles (ADMIN, ANALYST, VIEWER)
    console.log('🔐 Seeding Enterprise Roles (ADMIN, ANALYST, VIEWER)...');
    const adminRoleRes = await client.query<{ id: string }>(
      `INSERT INTO roles (name, description, permissions)
       VALUES ($1, $2, $3::jsonb) RETURNING id`,
      [
        ROLES.ADMIN,
        'Full platform administration, user management, dataset management, and permission configuration.',
        JSON.stringify(ROLE_CAPABILITIES.ADMIN),
      ]
    );
    const analystRoleRes = await client.query<{ id: string }>(
      `INSERT INTO roles (name, description, permissions)
       VALUES ($1, $2, $3::jsonb) RETURNING id`,
      [
        ROLES.ANALYST,
        'Explore datasets, run advanced multi-condition searches, create/share saved views, and analyze data.',
        JSON.stringify(ROLE_CAPABILITIES.ANALYST),
      ]
    );
    const viewerRoleRes = await client.query<{ id: string }>(
      `INSERT INTO roles (name, description, permissions)
       VALUES ($1, $2, $3::jsonb) RETURNING id`,
      [
        ROLES.VIEWER,
        'Browse authorized datasets, execute basic searches, view record details, and use shared views.',
        JSON.stringify(ROLE_CAPABILITIES.VIEWER),
      ]
    );

    const adminRoleId = adminRoleRes.rows[0]!.id;
    const analystRoleId = analystRoleRes.rows[0]!.id;
    const viewerRoleId = viewerRoleRes.rows[0]!.id;

    // 2. Seed Demo Users (Password: Password123!)
    console.log('👤 Seeding Demo Platform Users (Password123!)...');
    const passwordHash = await bcrypt.hash('Password123!', 10);

    const adminUserRes = await client.query<{ id: string }>(
      `INSERT INTO users (email, password_hash, full_name, role_id, is_active, last_login_at)
       VALUES ($1, $2, $3, $4, true, now()) RETURNING id`,
      ['admin@datascope.io', passwordHash, 'Elena Vance (Platform Admin)', adminRoleId]
    );
    const analystUserRes = await client.query<{ id: string }>(
      `INSERT INTO users (email, password_hash, full_name, role_id, is_active, last_login_at)
       VALUES ($1, $2, $3, $4, true, now()) RETURNING id`,
      ['analyst@datascope.io', passwordHash, 'Marcus Sterling (Lead Data Analyst)', analystRoleId]
    );
    const viewerUserRes = await client.query<{ id: string }>(
      `INSERT INTO users (email, password_hash, full_name, role_id, is_active, last_login_at)
       VALUES ($1, $2, $3, $4, true, now()) RETURNING id`,
      ['viewer@datascope.io', passwordHash, 'Sophia Chen (Executive Viewer)', viewerRoleId]
    );

    const adminUserId = adminUserRes.rows[0]!.id;
    const analystUserId = analystUserRes.rows[0]!.id;
    const viewerUserId = viewerUserRes.rows[0]!.id;

    // 3. Seed Datasets
    console.log('📊 Creating 3 Enterprise Datasets...');
    const ds1Res = await client.query<{ id: string }>(
      `INSERT INTO datasets (name, slug, description, category, data_source, total_records, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 100000, $6, now() - interval '180 days', now()) RETURNING id`,
      [
        'Global Enterprise Intelligence Directory',
        'global-enterprise-intelligence',
        'Master commercial intelligence repository containing 100,000+ verified global corporations, revenue metrics, risk telemetry, headcount, and regional compliance profiles.',
        'Corporate Intelligence',
        'SAP S/4HANA & Dun & Bradstreet Sync',
        adminUserId,
      ]
    );

    const ds2Res = await client.query<{ id: string }>(
      `INSERT INTO datasets (name, slug, description, category, data_source, total_records, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 2500, $6, now() - interval '120 days', now()) RETURNING id`,
      [
        'EMEA Financial & Risk Compliance Ledger',
        'emea-financial-risk-ledger',
        'High-priority European and Middle Eastern institutional entities tracked for regulatory KYC/AML risk scores, cross-border revenue exposure, and audit readiness.',
        'Financial Risk & Compliance',
        'Bloomberg Entity Exchange & FinCEN Feed',
        adminUserId,
      ]
    );

    const ds3Res = await client.query<{ id: string }>(
      `INSERT INTO datasets (name, slug, description, category, data_source, total_records, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 1500, $6, now() - interval '90 days', now()) RETURNING id`,
      [
        'Restricted M&A Target Pipeline (Confidential)',
        'restricted-ma-target-pipeline',
        'Executive-only dataset tracking strategic acquisition candidates, valuation multiples, and proprietary due-diligence scores. Restricted from general Viewer accounts.',
        'Strategic M&A',
        'Internal Corporate Development Vault',
        adminUserId,
      ]
    );

    const ds1Id = ds1Res.rows[0]!.id;
    const ds2Id = ds2Res.rows[0]!.id;
    const ds3Id = ds3Res.rows[0]!.id;

    // Seed User Preferences with defaultDatasetId = ds1Id
    for (const uid of [adminUserId, analystUserId, viewerUserId]) {
      await client.query(
        `INSERT INTO user_preferences (user_id, theme, default_page_size, table_density, default_dataset_id)
         VALUES ($1, 'dark', 50, 'compact', $2)`,
        [uid, ds1Id]
      );
    }

    // 4. Seed Dataset Fields (Core Columns + Dynamic JSONB Fields)
    console.log('🧩 Defining Dynamic Dataset Field Schemas...');
    const fieldDefinitions = [
      {
        fieldKey: 'recordCode',
        displayName: 'Entity ID',
        dataType: 'string',
        isCoreColumn: true,
        isSortable: true,
        isFilterable: true,
        isSearchable: true,
        isDefaultVisible: true,
        enumValues: null,
        sortOrder: 1,
      },
      {
        fieldKey: 'title',
        displayName: 'Organization Name',
        dataType: 'string',
        isCoreColumn: true,
        isSortable: true,
        isFilterable: true,
        isSearchable: true,
        isDefaultVisible: true,
        enumValues: null,
        sortOrder: 2,
      },
      {
        fieldKey: 'category',
        displayName: 'Industry Sector',
        dataType: 'enum',
        isCoreColumn: true,
        isSortable: true,
        isFilterable: true,
        isSearchable: true,
        isDefaultVisible: true,
        enumValues: [
          'FinTech',
          'Enterprise SaaS',
          'Healthcare & BioTech',
          'Advanced Manufacturing',
          'Global Logistics',
          'Clean Energy',
          'Cybersecurity',
          'AI & Cloud Infrastructure',
        ],
        sortOrder: 3,
      },
      {
        fieldKey: 'status',
        displayName: 'Status',
        dataType: 'enum',
        isCoreColumn: true,
        isSortable: true,
        isFilterable: true,
        isSearchable: true,
        isDefaultVisible: true,
        enumValues: ['Active', 'Pending', 'Suspended', 'Archived'],
        sortOrder: 4,
      },
      {
        fieldKey: 'country',
        displayName: 'Country',
        dataType: 'enum',
        isCoreColumn: true,
        isSortable: true,
        isFilterable: true,
        isSearchable: true,
        isDefaultVisible: true,
        enumValues: [
          'Germany',
          'United States',
          'United Kingdom',
          'Japan',
          'Singapore',
          'France',
          'Canada',
          'Australia',
          'Switzerland',
          'Netherlands',
          'Sweden',
          'Brazil',
        ],
        sortOrder: 5,
      },
      {
        fieldKey: 'revenue',
        displayName: 'Annual Revenue (USD)',
        dataType: 'currency',
        isCoreColumn: true,
        isSortable: true,
        isFilterable: true,
        isSearchable: false,
        isDefaultVisible: true,
        enumValues: null,
        sortOrder: 6,
      },
      {
        fieldKey: 'employeeCount',
        displayName: 'Employees',
        dataType: 'number',
        isCoreColumn: true,
        isSortable: true,
        isFilterable: true,
        isSearchable: false,
        isDefaultVisible: true,
        enumValues: null,
        sortOrder: 7,
      },
      {
        fieldKey: 'riskScore',
        displayName: 'Risk Score',
        dataType: 'number',
        isCoreColumn: true,
        isSortable: true,
        isFilterable: true,
        isSearchable: false,
        isDefaultVisible: true,
        enumValues: null,
        sortOrder: 8,
      },
      {
        fieldKey: 'region',
        displayName: 'Operating Region',
        dataType: 'enum',
        isCoreColumn: false,
        isSortable: true,
        isFilterable: true,
        isSearchable: true,
        isDefaultVisible: true,
        enumValues: ['EMEA', 'North America', 'APAC', 'LATAM'],
        sortOrder: 9,
      },
      {
        fieldKey: 'accountTier',
        displayName: 'Account Tier',
        dataType: 'enum',
        isCoreColumn: false,
        isSortable: true,
        isFilterable: true,
        isSearchable: true,
        isDefaultVisible: true,
        enumValues: ['Strategic Enterprise', 'Mid-Market', 'Growth Commercial', 'Emerging'],
        sortOrder: 10,
      },
      {
        fieldKey: 'complianceRating',
        displayName: 'ISO/SOC2 Rating',
        dataType: 'enum',
        isCoreColumn: false,
        isSortable: true,
        isFilterable: true,
        isSearchable: false,
        isDefaultVisible: false,
        enumValues: ['AAA-Verified', 'AA-Compliant', 'B-Under Review', 'Non-Compliant'],
        sortOrder: 11,
      },
      {
        fieldKey: 'cloudProvider',
        displayName: 'Primary Cloud',
        dataType: 'enum',
        isCoreColumn: false,
        isSortable: false,
        isFilterable: true,
        isSearchable: true,
        isDefaultVisible: false,
        enumValues: ['AWS', 'Google Cloud', 'Microsoft Azure', 'Hybrid Multi-Cloud'],
        sortOrder: 12,
      },
      {
        fieldKey: 'createdAt',
        displayName: 'Created Date',
        dataType: 'date',
        isCoreColumn: true,
        isSortable: true,
        isFilterable: true,
        isSearchable: false,
        isDefaultVisible: true,
        enumValues: null,
        sortOrder: 13,
      },
      {
        fieldKey: 'updatedAt',
        displayName: 'Last Updated',
        dataType: 'date',
        isCoreColumn: true,
        isSortable: true,
        isFilterable: true,
        isSearchable: false,
        isDefaultVisible: false,
        enumValues: null,
        sortOrder: 14,
      },
    ];

    for (const datasetId of [ds1Id, ds2Id, ds3Id]) {
      for (const f of fieldDefinitions) {
        await client.query(
          `INSERT INTO dataset_fields (
            dataset_id, field_key, display_name, data_type, is_core_column,
            is_sortable, is_filterable, is_searchable, is_default_visible, enum_values, sort_order
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11)`,
          [
            datasetId,
            f.fieldKey,
            f.displayName,
            f.dataType,
            f.isCoreColumn,
            f.isSortable,
            f.isFilterable,
            f.isSearchable,
            f.isDefaultVisible,
            f.enumValues ? JSON.stringify(f.enumValues) : null,
            f.sortOrder,
          ]
        );
      }
    }

    // 5. Seed Dataset-Level Access Permissions (Section 13 RBAC + Dataset Permissions)
    console.log('🛡️ Configuring Dataset-Level Access Permissions...');
    // Dataset 1: Accessible to ADMIN (all), ANALYST (view/search/export), VIEWER (view/search)
    await client.query(
      `INSERT INTO access_permissions (dataset_id, role_id, can_view, can_search, can_export, can_manage)
       VALUES
         ($1, $2, true, true, true, true),
         ($1, $3, true, true, true, false),
         ($1, $4, true, true, false, false)`,
      [ds1Id, adminRoleId, analystRoleId, viewerRoleId]
    );

    // Dataset 2: Accessible to ADMIN (all), ANALYST (view/search/export), VIEWER (view/search)
    await client.query(
      `INSERT INTO access_permissions (dataset_id, role_id, can_view, can_search, can_export, can_manage)
       VALUES
         ($1, $2, true, true, true, true),
         ($1, $3, true, true, true, false),
         ($1, $4, true, true, false, false)`,
      [ds2Id, adminRoleId, analystRoleId, viewerRoleId]
    );

    // Dataset 3 (Restricted M&A Pipeline): Accessible to ADMIN & ANALYST, explicitly DENIED to VIEWER
    await client.query(
      `INSERT INTO access_permissions (dataset_id, role_id, can_view, can_search, can_export, can_manage)
       VALUES
         ($1, $2, true, true, true, true),
         ($1, $3, true, true, false, false),
         ($1, $4, false, false, false, false)`,
      [ds3Id, adminRoleId, analystRoleId, viewerRoleId]
    );

    // Temporarily drop heavy GIN indexes during 104,000-row bulk insert for 10x faster ingestion
    console.log('⚡ Optimizing indexes for 104,000-row high-speed bulk generation...');
    await client.query(`
      DROP INDEX IF EXISTS "idx_records_fts_gin";
      DROP INDEX IF EXISTS "idx_records_trigram_gin";
      DROP INDEX IF EXISTS "idx_records_code_trigram_gin";
      DROP INDEX IF EXISTS "idx_records_attributes_gin";
    `);

    // 6. Generate 100,000 Records for Dataset 1 + 2,500 for Dataset 2 + 1,500 for Dataset 3 inside PostgreSQL
    console.log('🚀 Generating 100,000+ Enterprise Records in Cloud PostgreSQL...');
    const bulkStart = performance.now();

    const bulkInsertSql = `
      WITH constants AS (
        SELECT
          ARRAY[
            'Aether', 'Nexus', 'Vanguard', 'Vertex', 'Quantum', 'Hyperion', 'Synthetix', 'OmniCore',
            'Stratos', 'Pinnacle', 'Krono', 'Helios', 'Meridian', 'Vector', 'Valiance', 'Apex',
            'lumina', 'Zephyr', 'Cobalt', 'Titan', 'Solicore', 'Novus', 'Aurelia', 'Prime',
            'Astera', 'Cortex', 'Paladin', 'Equinox', 'Solstice', 'Horizon', 'Centurion', 'Atlas'
          ] AS prefixes,
          ARRAY[
            'Dynamics', 'Technologies', 'Systems', 'Global Holdings', 'BioSciences', 'Financial Group',
            'Logistics AG', 'Capital Partners', 'Cybernetics', 'Energy Solutions', 'Cloud Networks',
            'Industrial GmbH', 'Analytics Corp', 'Ventures', 'Semiconductors', 'Robotics Ltd'
          ] AS suffixes,
          ARRAY[
            'FinTech', 'Enterprise SaaS', 'Healthcare & BioTech', 'Advanced Manufacturing',
            'Global Logistics', 'Clean Energy', 'Cybersecurity', 'AI & Cloud Infrastructure'
          ] AS categories,
          ARRAY[
            'Active', 'Active', 'Active', 'Active', 'Active',
            'Pending', 'Pending', 'Suspended', 'Archived'
          ] AS statuses,
          ARRAY[
            'Germany', 'United States', 'United Kingdom', 'Japan', 'Singapore', 'France',
            'Canada', 'Australia', 'Switzerland', 'Netherlands', 'Sweden', 'Brazil'
          ] AS countries,
          ARRAY['EMEA', 'North America', 'EMEA', 'APAC', 'APAC', 'EMEA', 'North America', 'APAC', 'EMEA', 'EMEA', 'EMEA', 'LATAM'] AS regions,
          ARRAY['Strategic Enterprise', 'Mid-Market', 'Growth Commercial', 'Emerging'] AS tiers,
          ARRAY['AAA-Verified', 'AA-Compliant', 'B-Under Review', 'Non-Compliant'] AS ratings,
          ARRAY['AWS', 'Google Cloud', 'Microsoft Azure', 'Hybrid Multi-Cloud'] AS clouds
      )
      INSERT INTO dataset_records (
        dataset_id, record_code, title, category, status, country,
        revenue, employee_count, risk_score, attributes, search_text, created_at, updated_at
      )
      SELECT
        $1::uuid AS dataset_id,
        $2::text || '-' || LPAD(g.i::text, 6, '0') AS record_code,
        c.prefixes[1 + (g.i % array_length(c.prefixes, 1))] || ' ' ||
          c.suffixes[1 + ((g.i / 7) % array_length(c.suffixes, 1))] || ' #' || g.i AS title,
        c.categories[1 + ((g.i / 3) % array_length(c.categories, 1))] AS category,
        c.statuses[1 + ((g.i / 5) % array_length(c.statuses, 1))] AS status,
        c.countries[1 + ((g.i / 2) % array_length(c.countries, 1))] AS country,
        ROUND((5000 + ((g.i * 1973::bigint) % 4995000) + ((g.i % 99) * 0.25))::numeric, 2) AS revenue,
        15 + ((g.i * 37) % 14985) AS employee_count,
        ROUND((5 + ((g.i * 19) % 90) + ((g.i % 10) * 0.1))::numeric, 2) AS risk_score,
        jsonb_build_object(
          'region', c.regions[1 + ((g.i / 2) % array_length(c.countries, 1))],
          'accountTier', c.tiers[1 + (g.i % array_length(c.tiers, 1))],
          'complianceRating', c.ratings[1 + ((g.i / 4) % array_length(c.ratings, 1))],
          'cloudProvider', c.clouds[1 + ((g.i / 6) % array_length(c.clouds, 1))],
          'annualGrowthPct', ROUND(((-5 + (g.i % 65)) * 1.1)::numeric, 1),
          'verified', (g.i % 5 <> 0)
        ) AS attributes,
        ($2::text || '-' || LPAD(g.i::text, 6, '0')) || ' ' ||
          c.prefixes[1 + (g.i % array_length(c.prefixes, 1))] || ' ' ||
          c.suffixes[1 + ((g.i / 7) % array_length(c.suffixes, 1))] || ' ' ||
          c.categories[1 + ((g.i / 3) % array_length(c.categories, 1))] || ' ' ||
          c.countries[1 + ((g.i / 2) % array_length(c.countries, 1))] || ' ' ||
          c.regions[1 + ((g.i / 2) % array_length(c.countries, 1))] || ' ' ||
          c.tiers[1 + (g.i % array_length(c.tiers, 1))] || ' ' ||
          c.clouds[1 + ((g.i / 6) % array_length(c.clouds, 1))] AS search_text,
        now() - ((g.i % 360) || ' days')::interval - ((g.i % 86400) || ' seconds')::interval AS created_at,
        now() - ((g.i % 30) || ' days')::interval AS updated_at
      FROM generate_series(1, $3::int) AS g(i)
      CROSS JOIN constants c;
    `;

    // Insert 100,000 records into Dataset 1
    await client.query(bulkInsertSql, [ds1Id, 'ENT', 100000]);
    // Insert 2,500 records into Dataset 2
    await client.query(bulkInsertSql, [ds2Id, 'EMEA', 2500]);
    // Insert 1,500 records into Dataset 3
    await client.query(bulkInsertSql, [ds3Id, 'MNA', 1500]);

    console.log(
      `✅ Inserted 104,000 records in ${Math.round(performance.now() - bulkStart)}ms. Rebuilding GIN FTS, Trigram & JSONB indexes...`
    );

    const indexStart = performance.now();
    await client.query(`
      CREATE INDEX IF NOT EXISTS "idx_records_fts_gin"
        ON "dataset_records" USING GIN (to_tsvector('english', "search_text"));
      CREATE INDEX IF NOT EXISTS "idx_records_trigram_gin"
        ON "dataset_records" USING GIN ("search_text" gin_trgm_ops);
      CREATE INDEX IF NOT EXISTS "idx_records_code_trigram_gin"
        ON "dataset_records" USING GIN ("record_code" gin_trgm_ops);
      CREATE INDEX IF NOT EXISTS "idx_records_attributes_gin"
        ON "dataset_records" USING GIN ("attributes" jsonb_path_ops);
    `);
    console.log(`✅ Specialized GIN indexes built in ${Math.round(performance.now() - indexStart)}ms.`);

    // 7. Seed Record Relationships & Historical Changes for Top 300 Records (Section 3.E)
    console.log('🔗 Seeding Record Relationships & Historical Audit Trails...');
    await client.query(`
      WITH top_records AS (
        SELECT id, record_code, title, status, revenue, ROW_NUMBER() OVER (ORDER BY created_at DESC, id ASC) AS rn
        FROM dataset_records
        WHERE dataset_id = $1
        LIMIT 300
      )
      INSERT INTO record_relationships (source_record_id, target_record_id, relationship_type, metadata)
      SELECT
        r1.id,
        r2.id,
        CASE (r1.rn % 4)
          WHEN 0 THEN 'PARENT_COMPANY'
          WHEN 1 THEN 'SUBSIDIARY'
          WHEN 2 THEN 'STRATEGIC_PARTNER'
          ELSE 'SUPPLIER'
        END,
        jsonb_build_object(
          'confidenceScore', 92 + (r1.rn % 8),
          'verifiedSource', 'Corporate Registry & SEC Filing',
          'effectiveYear', 2023 + (r1.rn % 4)
        )
      FROM top_records r1
      JOIN top_records r2 ON r2.rn = (r1.rn % 299) + 1
      WHERE r1.id <> r2.id;
    `, [ds1Id]);

    await client.query(`
      WITH sample_records AS (
        SELECT id, status, revenue, employee_count
        FROM dataset_records
        WHERE dataset_id = $1
        ORDER BY created_at DESC, id ASC
        LIMIT 250
      )
      INSERT INTO record_history (record_id, changed_by, change_type, summary, previous_values, new_values, changed_at)
      SELECT
        sr.id,
        $2::uuid,
        'CREATED',
        'Initial record ingested from SAP S/4HANA & Dun & Bradstreet pipeline',
        null,
        jsonb_build_object('status', 'Pending', 'revenue', ROUND((sr.revenue * 0.85)::numeric, 2)),
        now() - interval '45 days'
      FROM sample_records sr
      UNION ALL
      SELECT
        sr.id,
        $3::uuid,
        'UPDATED',
        'Annual revenue verified and compliance status upgraded following Q4 review',
        jsonb_build_object('status', 'Pending', 'revenue', ROUND((sr.revenue * 0.85)::numeric, 2)),
        jsonb_build_object('status', sr.status, 'revenue', sr.revenue, 'employeeCount', sr.employee_count),
        now() - interval '7 days'
      FROM sample_records sr;
    `, [ds1Id, adminUserId, analystUserId]);

    // 8. Seed Saved Views (Section 8 - Including Section 3.C Canonical Filter Example)
    console.log('📌 Seeding Saved Views & Shared Team Views...');
    const defaultVisibleCols = JSON.stringify([
      'recordCode',
      'title',
      'category',
      'status',
      'country',
      'revenue',
      'employeeCount',
      'riskScore',
      'region',
      'accountTier',
      'createdAt',
    ]);

    await client.query(
      `INSERT INTO saved_views (
        name, description, dataset_id, user_id, search_query, search_mode,
        filters, sorting, visible_columns, is_shared, shared_with_roles
      ) VALUES
      (
        'Germany Active Accounts > $10k (Last 30 Days)',
        'Canonical executive discovery view: Active German organizations with revenue exceeding $10,000 created within the last 30 days.',
        $1, $2, '', 'fts',
        $4::jsonb,
        '[{"field":"revenue","direction":"desc"},{"field":"createdAt","direction":"desc"}]'::jsonb,
        $7::jsonb,
        true,
        '["ADMIN","ANALYST","VIEWER"]'::jsonb
      ),
      (
        'High-Revenue FinTech & AI Leaders (> $1M)',
        'Strategic enterprise accounts in FinTech and AI & Cloud Infrastructure with annual revenue above $1,000,000.',
        $1, $2, '', 'fts',
        $5::jsonb,
        '[{"field":"revenue","direction":"desc"}]'::jsonb,
        $7::jsonb,
        true,
        '["ADMIN","ANALYST","VIEWER"]'::jsonb
      ),
      (
        'Elevated Risk Watchlist (Risk Score >= 75)',
        'Compliance monitoring view isolating entities with risk scores >= 75 requiring enhanced due diligence.',
        $1, $3, '', 'fts',
        $6::jsonb,
        '[{"field":"riskScore","direction":"desc"},{"field":"revenue","direction":"desc"}]'::jsonb,
        $7::jsonb,
        true,
        '["ADMIN","ANALYST"]'::jsonb
      )`,
      [
        ds1Id,
        analystUserId,
        adminUserId,
        JSON.stringify([
          { id: 'f-status', field: 'status', operator: 'eq', value: 'Active' },
          { id: 'f-country', field: 'country', operator: 'eq', value: 'Germany' },
          { id: 'f-rev', field: 'revenue', operator: 'gt', value: 10000 },
          { id: 'f-date', field: 'createdAt', operator: 'lastNDays', value: 30 },
        ]),
        JSON.stringify([
          { id: 'f-cat', field: 'category', operator: 'in', value: ['FinTech', 'AI & Cloud Infrastructure'] },
          { id: 'f-status2', field: 'status', operator: 'eq', value: 'Active' },
          { id: 'f-rev2', field: 'revenue', operator: 'gte', value: 1000000 },
        ]),
        JSON.stringify([
          { id: 'f-risk', field: 'riskScore', operator: 'gte', value: 75 },
          { id: 'f-status3', field: 'status', operator: 'neq', value: 'Archived' },
        ]),
        defaultVisibleCols,
      ]
    );

    // 9. Seed 40 Realistic Search History Entries over the past 14 days (for Analytics & History Page)
    console.log('🕒 Seeding Search History Telemetry...');
    await client.query(
      `INSERT INTO search_history (user_id, dataset_id, search_query, filters, sorting, result_count, execution_time_ms, executed_at)
       SELECT
         CASE (g.i % 3) WHEN 0 THEN $2::uuid WHEN 1 THEN $3::uuid ELSE $4::uuid END,
         $1::uuid,
         CASE (g.i % 6)
           WHEN 0 THEN 'Quantum Dynamics'
           WHEN 1 THEN 'Germany FinTech'
           WHEN 2 THEN 'ENT-0004'
           WHEN 3 THEN 'Hyperion Cloud'
           WHEN 4 THEN 'Cybersecurity'
           ELSE ''
         END,
         CASE (g.i % 4)
           WHEN 0 THEN '[{"field":"status","operator":"eq","value":"Active"},{"field":"country","operator":"eq","value":"Germany"},{"field":"revenue","operator":"gt","value":10000}]'::jsonb
           WHEN 1 THEN '[{"field":"category","operator":"eq","value":"FinTech"},{"field":"revenue","operator":"gte","value":500000}]'::jsonb
           WHEN 2 THEN '[{"field":"riskScore","operator":"gte","value":70},{"field":"status","operator":"eq","value":"Pending"}]'::jsonb
           ELSE '[{"field":"country","operator":"eq","value":"United States"},{"field":"employeeCount","operator":"gte","value":500}]'::jsonb
         END,
         '[{"field":"revenue","direction":"desc"}]'::jsonb,
         120 + (g.i * 47),
         8 + (g.i % 19),
         now() - ((g.i % 14) || ' days')::interval - ((g.i * 15) || ' minutes')::interval
       FROM generate_series(1, 45) AS g(i)`,
      [ds1Id, analystUserId, adminUserId, viewerUserId]
    );

    await client.query('COMMIT');

    // Run ANALYZE outside transaction block so PostgreSQL planner has fresh histograms
    console.log('📈 Running PostgreSQL ANALYZE to update query planner statistics...');
    await client.query('ANALYZE dataset_records;');
    await client.query('ANALYZE datasets;');
    await client.query('ANALYZE access_permissions;');

    const totalElapsed = ((performance.now() - overallStart) / 1000).toFixed(2);
    console.log(`🎉 Seed complete in ${totalElapsed}s! Total records generated: 104,000.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seeding failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

if (process.argv[1] && process.argv[1].endsWith('seed-100k.ts')) {
  seedDatabase()
    .then(async () => {
      await pool.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error(err);
      await pool.end();
      process.exit(1);
    });
}
