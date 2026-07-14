


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."user_role" AS ENUM (
    'admin',
    'reception',
    'mechanic',
    'accountant',
    'chief_mechanic',
    'warehouse'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_user_role"() RETURNS "public"."user_role"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select role
  from public.profiles
  where id = auth.uid()
    and is_active = true
  limit 1;
$$;


ALTER FUNCTION "public"."current_user_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_devis_number"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.devis_number :=
    'DV-' ||
    to_char(now(), 'YYMM') ||
    '-' ||
    lpad(nextval('devis_seq')::text, 6, '0');

  return new;
end;
$$;


ALTER FUNCTION "public"."generate_devis_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_facture_number"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.facture_number :=
    'FA-' ||
    to_char(now(), 'YYMM') ||
    '-' ||
    lpad(nextval('facture_seq')::text, 6, '0');

  return new;
end;
$$;


ALTER FUNCTION "public"."generate_facture_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_work_order_number"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.order_number :=
    'OR-' ||
    to_char(now(), 'YYMM') ||
    '-' ||
    lpad(nextval('work_order_seq')::text, 6, '0');

  return new;
end;
$$;


ALTER FUNCTION "public"."generate_work_order_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.profiles (
    id,
    full_name,
    role
  )
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      split_part(new.email, '@', 1)
    ),
    'mechanic'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_permission"("requested_permission" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    case
      when not exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and p.is_active = true
      )
      then false

      when exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and p.is_active = true
          and p.role = 'admin'
      )
      then true

      when exists (
        select 1
        from public.user_permission_overrides upo
        where upo.user_id = auth.uid()
          and upo.permission_key = requested_permission
      )
      then coalesce((
        select upo.allowed
        from public.user_permission_overrides upo
        where upo.user_id = auth.uid()
          and upo.permission_key = requested_permission
        limit 1
      ), false)

      else coalesce((
        select rp.allowed
        from public.profiles p
        join public.role_permissions rp
          on rp.role = p.role
        where p.id = auth.uid()
          and p.is_active = true
          and rp.permission_key = requested_permission
        limit 1
      ), false)
    end;
$$;


ALTER FUNCTION "public"."has_permission"("requested_permission" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."app_permissions" (
    "permission_key" "text" NOT NULL,
    "label" "text" NOT NULL,
    "section" "text" NOT NULL,
    "description" "text",
    "sort_order" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."app_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."app_settings" (
    "id" "text" DEFAULT 'main'::"text" NOT NULL,
    "settings" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."app_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."appointments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "client_id" "uuid",
    "vehicle_id" "uuid",
    "appointment_date" "date" NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone,
    "title" "text" NOT NULL,
    "description" "text",
    "mechanic" "text",
    "lift" "text",
    "status" "text" DEFAULT 'planned'::"text" NOT NULL,
    "work_order_id" "uuid",
    "new_client_name" "text",
    "new_client_phone" "text",
    "new_client_email" "text",
    "new_vehicle_brand" "text",
    "new_vehicle_model" "text",
    "new_vehicle_plate" "text",
    "new_vehicle_vin" "text"
);


ALTER TABLE "public"."appointments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "full_name" "text" NOT NULL,
    "phone" "text",
    "email" "text",
    "address" "text",
    "notes" "text",
    "client_type" "text" DEFAULT 'particulier'::"text",
    "company_name" "text",
    "siren" "text",
    "siret" "text",
    "vat_number" "text",
    "billing_address" "text",
    "delivery_address" "text"
);


ALTER TABLE "public"."clients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key" "text" NOT NULL,
    "name" "text" NOT NULL,
    "address" "text",
    "siret" "text",
    "tva_number" "text",
    "phone" "text",
    "email" "text",
    "tva_rate" numeric DEFAULT 0,
    "vat_mention" "text",
    "legal_form" "text",
    "siren" "text",
    "rcs" "text",
    "ape" "text",
    "capital" "text",
    "manager_name" "text",
    "website" "text",
    "iban" "text",
    "bic" "text",
    "bank_name" "text",
    "logo_url" "text",
    "signature_url" "text",
    "stamp_url" "text",
    "whatsapp" "text",
    "instagram" "text",
    "facebook" "text",
    "google_maps_url" "text",
    "invoice_footer" "text",
    "devis_footer" "text",
    "work_order_footer" "text",
    "payment_terms" "text",
    "warranty_terms" "text",
    "late_penalty_terms" "text",
    "recovery_terms" "text",
    "custom_legal_text" "text",
    "default_devis_validity_days" integer DEFAULT 30,
    "default_invoice_due_days" integer DEFAULT 0,
    "default_deposit_percent" numeric DEFAULT 0,
    "currency" "text" DEFAULT 'EUR'::"text",
    "is_default" boolean DEFAULT false,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."company_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."devis" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "work_order_id" "uuid",
    "devis_number" "text",
    "seller" "text" DEFAULT 'srvauto'::"text" NOT NULL,
    "lang" "text" DEFAULT 'fr'::"text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "total_ht" numeric DEFAULT 0,
    "tva_amount" numeric DEFAULT 0,
    "total_ttc" numeric DEFAULT 0,
    "source_lang" "text" DEFAULT 'ru'::"text",
    "translated_payload" "jsonb",
    "translated_at" timestamp with time zone,
    "converted_to_facture" boolean DEFAULT false NOT NULL,
    "facture_id" "uuid",
    "converted_at" timestamp with time zone
);


ALTER TABLE "public"."devis" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."devis_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."devis_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "work_order_id" "uuid",
    "document_type" "text" NOT NULL,
    "document_number" "text",
    "seller" "text" DEFAULT 'srvauto'::"text" NOT NULL,
    "lang" "text" DEFAULT 'fr'::"text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "total_ht" numeric DEFAULT 0,
    "tva_amount" numeric DEFAULT 0,
    "total_ttc" numeric DEFAULT 0
);


ALTER TABLE "public"."documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employees" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "full_name" "text" NOT NULL,
    "role" "text" DEFAULT 'mechanic'::"text",
    "phone" "text",
    "email" "text",
    "active" boolean DEFAULT true,
    "notes" "text"
);


ALTER TABLE "public"."employees" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."facture_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."facture_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."factures" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "work_order_id" "uuid",
    "devis_id" "uuid",
    "facture_number" "text",
    "seller" "text" DEFAULT 'srvauto'::"text" NOT NULL,
    "lang" "text" DEFAULT 'fr'::"text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "total_ht" numeric DEFAULT 0,
    "tva_amount" numeric DEFAULT 0,
    "total_ttc" numeric DEFAULT 0,
    "source_lang" "text" DEFAULT 'ru'::"text",
    "translated_payload" "jsonb",
    "translated_at" timestamp with time zone
);


ALTER TABLE "public"."factures" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "part_number" "text",
    "manufacturer" "text",
    "name" "text" NOT NULL,
    "purchase_price" numeric DEFAULT 0,
    "sale_price" numeric DEFAULT 0,
    "quantity" numeric DEFAULT 0,
    "location" "text",
    "notes" "text",
    "is_active" boolean DEFAULT true,
    "min_quantity" numeric DEFAULT 0,
    "supplier" "text",
    "last_purchase_date" "date",
    "supplier_name" "text",
    "brand" "text",
    "reference" "text"
);


ALTER TABLE "public"."inventory" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_movements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "inventory_item_id" "uuid" NOT NULL,
    "work_order_id" "uuid",
    "work_order_part_item_id" "uuid",
    "movement_type" "text" NOT NULL,
    "quantity" numeric NOT NULL,
    "note" "text"
);


ALTER TABLE "public"."inventory_movements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text",
    "role" "public"."user_role" DEFAULT 'mechanic'::"public"."user_role" NOT NULL,
    "phone" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."role_permissions" (
    "role" "public"."user_role" NOT NULL,
    "permission_key" "text" NOT NULL,
    "allowed" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."role_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_catalog" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name" "text" NOT NULL,
    "category" "text",
    "default_price" numeric DEFAULT 0,
    "labor_hours" numeric DEFAULT 0,
    "description" "text",
    "recommended_parts" "text",
    "is_active" boolean DEFAULT true,
    "rate_tier" "text" DEFAULT 'T1'::"text"
);


ALTER TABLE "public"."service_catalog" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."suppliers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name" "text" NOT NULL,
    "contact_name" "text",
    "phone" "text",
    "email" "text",
    "address" "text",
    "website" "text",
    "notes" "text"
);


ALTER TABLE "public"."suppliers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_permission_overrides" (
    "user_id" "uuid" NOT NULL,
    "permission_key" "text" NOT NULL,
    "allowed" boolean NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_permission_overrides" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vehicle_mileage_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "vehicle_id" "uuid" NOT NULL,
    "work_order_id" "uuid",
    "mileage" integer NOT NULL,
    "source" "text" DEFAULT 'manual'::"text" NOT NULL,
    "note" "text",
    "recorded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "vehicle_mileage_history_mileage_check" CHECK (("mileage" >= 0))
);


ALTER TABLE "public"."vehicle_mileage_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vehicle_recommendations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "vehicle_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "due_mileage" "text",
    "due_date" "date"
);


ALTER TABLE "public"."vehicle_recommendations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vehicles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "client_id" "uuid",
    "vin" "text",
    "plate" "text",
    "brand" "text" NOT NULL,
    "model" "text" NOT NULL,
    "year" "text",
    "engine" "text",
    "mileage" "text",
    "fuel" "text",
    "gearbox" "text",
    "color" "text",
    "notes" "text"
);


ALTER TABLE "public"."vehicles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."work_order_checklists" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "work_order_id" "uuid",
    "fuel_level" "text",
    "vehicle_condition" "text",
    "personal_items" "text",
    "has_registration_card" boolean DEFAULT false,
    "has_locking_wheel_nut" boolean DEFAULT false,
    "has_service_book" boolean DEFAULT false,
    "has_warning_lights" boolean DEFAULT false,
    "has_visible_damage" boolean DEFAULT false,
    "notes" "text"
);


ALTER TABLE "public"."work_order_checklists" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."work_order_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "work_order_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "description" "text",
    "user_name" "text",
    "color" "text" DEFAULT 'gray'::"text"
);


ALTER TABLE "public"."work_order_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."work_order_labor_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "work_order_id" "uuid",
    "description" "text" NOT NULL,
    "quantity" numeric DEFAULT 1 NOT NULL,
    "unit_price" numeric DEFAULT 0 NOT NULL,
    "total" numeric DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."work_order_labor_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."work_order_part_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "work_order_id" "uuid",
    "name" "text" NOT NULL,
    "reference" "text",
    "quantity" numeric DEFAULT 1 NOT NULL,
    "unit_price" numeric DEFAULT 0 NOT NULL,
    "total" numeric DEFAULT 0 NOT NULL,
    "inventory_item_id" "uuid",
    "stock_deducted" boolean DEFAULT false,
    "purchase_price" numeric DEFAULT 0 NOT NULL,
    "profit" numeric DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."work_order_part_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."work_order_payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "work_order_id" "uuid" NOT NULL,
    "amount" numeric NOT NULL,
    "payment_method" "text",
    "payment_date" timestamp with time zone DEFAULT "now"(),
    "note" "text"
);


ALTER TABLE "public"."work_order_payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."work_order_photos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "work_order_id" "uuid",
    "photo_url" "text" NOT NULL,
    "category" "text" DEFAULT 'reception'::"text",
    "notes" "text",
    "storage_path" "text"
);


ALTER TABLE "public"."work_order_photos" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."work_order_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."work_order_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."work_order_signatures" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "work_order_id" "uuid" NOT NULL,
    "signature_type" "text" DEFAULT 'reception'::"text" NOT NULL,
    "signer_name" "text",
    "signature_url" "text" NOT NULL,
    "storage_path" "text",
    "signed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."work_order_signatures" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."work_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "client_id" "uuid",
    "vehicle_id" "uuid",
    "mileage" "text",
    "customer_complaint" "text",
    "work_description" "text",
    "status" "text" DEFAULT 'Записан'::"text" NOT NULL,
    "labor_total" numeric DEFAULT 0,
    "parts_total" numeric DEFAULT 0,
    "total_amount" numeric DEFAULT 0,
    "notes" "text",
    "order_number" "text",
    "discount_amount" numeric DEFAULT 0,
    "paid_amount" numeric DEFAULT 0,
    "payment_status" "text" DEFAULT 'Не оплачено'::"text",
    "payment_method" "text",
    "payment_date" timestamp with time zone,
    "parts_cost_total" numeric DEFAULT 0 NOT NULL,
    "gross_profit" numeric DEFAULT 0 NOT NULL,
    "margin_percent" numeric DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."work_orders" OWNER TO "postgres";


ALTER TABLE ONLY "public"."app_permissions"
    ADD CONSTRAINT "app_permissions_pkey" PRIMARY KEY ("permission_key");



ALTER TABLE ONLY "public"."app_settings"
    ADD CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_settings"
    ADD CONSTRAINT "company_settings_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."company_settings"
    ADD CONSTRAINT "company_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."devis"
    ADD CONSTRAINT "devis_devis_number_key" UNIQUE ("devis_number");



ALTER TABLE ONLY "public"."devis"
    ADD CONSTRAINT "devis_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_document_number_key" UNIQUE ("document_number");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."factures"
    ADD CONSTRAINT "factures_facture_number_key" UNIQUE ("facture_number");



ALTER TABLE ONLY "public"."factures"
    ADD CONSTRAINT "factures_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_movements"
    ADD CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory"
    ADD CONSTRAINT "inventory_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role", "permission_key");



ALTER TABLE ONLY "public"."service_catalog"
    ADD CONSTRAINT "service_catalog_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."suppliers"
    ADD CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_permission_overrides"
    ADD CONSTRAINT "user_permission_overrides_pkey" PRIMARY KEY ("user_id", "permission_key");



ALTER TABLE ONLY "public"."vehicle_mileage_history"
    ADD CONSTRAINT "vehicle_mileage_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vehicle_recommendations"
    ADD CONSTRAINT "vehicle_recommendations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vehicles"
    ADD CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."work_order_checklists"
    ADD CONSTRAINT "work_order_checklists_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."work_order_history"
    ADD CONSTRAINT "work_order_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."work_order_labor_items"
    ADD CONSTRAINT "work_order_labor_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."work_order_part_items"
    ADD CONSTRAINT "work_order_part_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."work_order_payments"
    ADD CONSTRAINT "work_order_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."work_order_photos"
    ADD CONSTRAINT "work_order_photos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."work_order_signatures"
    ADD CONSTRAINT "work_order_signatures_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."work_order_signatures"
    ADD CONSTRAINT "work_order_signatures_work_order_id_signature_type_key" UNIQUE ("work_order_id", "signature_type");



ALTER TABLE ONLY "public"."work_orders"
    ADD CONSTRAINT "work_orders_pkey" PRIMARY KEY ("id");



CREATE INDEX "role_permissions_role_idx" ON "public"."role_permissions" USING "btree" ("role");



CREATE INDEX "user_permission_overrides_user_id_idx" ON "public"."user_permission_overrides" USING "btree" ("user_id");



CREATE INDEX "vehicle_mileage_history_recorded_at_idx" ON "public"."vehicle_mileage_history" USING "btree" ("recorded_at" DESC);



CREATE INDEX "vehicle_mileage_history_vehicle_id_idx" ON "public"."vehicle_mileage_history" USING "btree" ("vehicle_id");



CREATE INDEX "work_order_part_items_work_order_id_idx" ON "public"."work_order_part_items" USING "btree" ("work_order_id");



CREATE INDEX "work_orders_created_at_idx" ON "public"."work_orders" USING "btree" ("created_at" DESC);



CREATE OR REPLACE TRIGGER "set_devis_number" BEFORE INSERT ON "public"."devis" FOR EACH ROW WHEN (("new"."devis_number" IS NULL)) EXECUTE FUNCTION "public"."generate_devis_number"();



CREATE OR REPLACE TRIGGER "set_facture_number" BEFORE INSERT ON "public"."factures" FOR EACH ROW WHEN (("new"."facture_number" IS NULL)) EXECUTE FUNCTION "public"."generate_facture_number"();



CREATE OR REPLACE TRIGGER "set_work_order_number" BEFORE INSERT ON "public"."work_orders" FOR EACH ROW WHEN (("new"."order_number" IS NULL)) EXECUTE FUNCTION "public"."generate_work_order_number"();



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id");



ALTER TABLE ONLY "public"."devis"
    ADD CONSTRAINT "devis_facture_id_fkey" FOREIGN KEY ("facture_id") REFERENCES "public"."factures"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."devis"
    ADD CONSTRAINT "devis_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."factures"
    ADD CONSTRAINT "factures_devis_id_fkey" FOREIGN KEY ("devis_id") REFERENCES "public"."devis"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."factures"
    ADD CONSTRAINT "factures_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_movements"
    ADD CONSTRAINT "inventory_movements_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_movements"
    ADD CONSTRAINT "inventory_movements_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."inventory_movements"
    ADD CONSTRAINT "inventory_movements_work_order_part_item_id_fkey" FOREIGN KEY ("work_order_part_item_id") REFERENCES "public"."work_order_part_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_permission_key_fkey" FOREIGN KEY ("permission_key") REFERENCES "public"."app_permissions"("permission_key") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_permission_overrides"
    ADD CONSTRAINT "user_permission_overrides_permission_key_fkey" FOREIGN KEY ("permission_key") REFERENCES "public"."app_permissions"("permission_key") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_permission_overrides"
    ADD CONSTRAINT "user_permission_overrides_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vehicle_mileage_history"
    ADD CONSTRAINT "vehicle_mileage_history_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vehicle_mileage_history"
    ADD CONSTRAINT "vehicle_mileage_history_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."vehicle_recommendations"
    ADD CONSTRAINT "vehicle_recommendations_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vehicles"
    ADD CONSTRAINT "vehicles_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."work_order_checklists"
    ADD CONSTRAINT "work_order_checklists_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."work_order_history"
    ADD CONSTRAINT "work_order_history_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."work_order_labor_items"
    ADD CONSTRAINT "work_order_labor_items_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."work_order_part_items"
    ADD CONSTRAINT "work_order_part_items_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory"("id");



ALTER TABLE ONLY "public"."work_order_part_items"
    ADD CONSTRAINT "work_order_part_items_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."work_order_payments"
    ADD CONSTRAINT "work_order_payments_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."work_order_photos"
    ADD CONSTRAINT "work_order_photos_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."work_order_signatures"
    ADD CONSTRAINT "work_order_signatures_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."work_orders"
    ADD CONSTRAINT "work_orders_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."work_orders"
    ADD CONSTRAINT "work_orders_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE SET NULL;



CREATE POLICY "Allow public delete clients" ON "public"."clients" FOR DELETE TO "anon" USING (true);



CREATE POLICY "Allow public delete labor items" ON "public"."work_order_labor_items" FOR DELETE TO "anon" USING (true);



CREATE POLICY "Allow public delete part items" ON "public"."work_order_part_items" FOR DELETE TO "anon" USING (true);



CREATE POLICY "Allow public delete service_catalog" ON "public"."service_catalog" FOR DELETE TO "anon" USING (true);



CREATE POLICY "Allow public delete vehicles" ON "public"."vehicles" FOR DELETE TO "anon" USING (true);



CREATE POLICY "Allow public delete work_orders" ON "public"."work_orders" FOR DELETE TO "anon" USING (true);



CREATE POLICY "Allow public insert clients" ON "public"."clients" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "Allow public insert labor items" ON "public"."work_order_labor_items" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "Allow public insert part items" ON "public"."work_order_part_items" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "Allow public insert service_catalog" ON "public"."service_catalog" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "Allow public insert vehicles" ON "public"."vehicles" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "Allow public insert work_orders" ON "public"."work_orders" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "Allow public read clients" ON "public"."clients" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Allow public read labor items" ON "public"."work_order_labor_items" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Allow public read part items" ON "public"."work_order_part_items" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Allow public read service_catalog" ON "public"."service_catalog" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Allow public read vehicles" ON "public"."vehicles" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Allow public read work_orders" ON "public"."work_orders" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Allow public update clients" ON "public"."clients" FOR UPDATE TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "Allow public update labor items" ON "public"."work_order_labor_items" FOR UPDATE TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "Allow public update part items" ON "public"."work_order_part_items" FOR UPDATE TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "Allow public update service_catalog" ON "public"."service_catalog" FOR UPDATE TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "Allow public update vehicles" ON "public"."vehicles" FOR UPDATE TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "app settings delete" ON "public"."app_settings" FOR DELETE TO "authenticated", "anon" USING (true);



CREATE POLICY "app settings insert" ON "public"."app_settings" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "app settings select" ON "public"."app_settings" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "app settings update" ON "public"."app_settings" FOR UPDATE TO "authenticated", "anon" USING (true) WITH CHECK (true);



ALTER TABLE "public"."app_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."app_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."appointments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "appointments delete" ON "public"."appointments" FOR DELETE TO "anon" USING (true);



CREATE POLICY "appointments insert" ON "public"."appointments" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "appointments read" ON "public"."appointments" FOR SELECT TO "anon" USING (true);



CREATE POLICY "appointments update" ON "public"."appointments" FOR UPDATE TO "anon" USING (true) WITH CHECK (true);



ALTER TABLE "public"."clients" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company settings delete" ON "public"."company_settings" FOR DELETE TO "anon" USING (true);



CREATE POLICY "company settings insert" ON "public"."company_settings" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "company settings read" ON "public"."company_settings" FOR SELECT TO "anon" USING (true);



CREATE POLICY "company settings update" ON "public"."company_settings" FOR UPDATE TO "anon" USING (true) WITH CHECK (true);



ALTER TABLE "public"."company_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."devis" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "devis delete" ON "public"."devis" FOR DELETE TO "anon" USING (true);



CREATE POLICY "devis insert" ON "public"."devis" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "devis read" ON "public"."devis" FOR SELECT TO "anon" USING (true);



CREATE POLICY "devis update" ON "public"."devis" FOR UPDATE TO "anon" USING (true) WITH CHECK (true);



ALTER TABLE "public"."documents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "documents delete" ON "public"."documents" FOR DELETE TO "anon" USING (true);



CREATE POLICY "documents insert" ON "public"."documents" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "documents read" ON "public"."documents" FOR SELECT TO "anon" USING (true);



CREATE POLICY "documents update" ON "public"."documents" FOR UPDATE TO "anon" USING (true) WITH CHECK (true);



ALTER TABLE "public"."employees" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "employees delete" ON "public"."employees" FOR DELETE TO "anon" USING (true);



CREATE POLICY "employees insert" ON "public"."employees" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "employees read" ON "public"."employees" FOR SELECT TO "anon" USING (true);



CREATE POLICY "employees update" ON "public"."employees" FOR UPDATE TO "anon" USING (true) WITH CHECK (true);



ALTER TABLE "public"."factures" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "factures delete" ON "public"."factures" FOR DELETE TO "anon" USING (true);



CREATE POLICY "factures insert" ON "public"."factures" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "factures read" ON "public"."factures" FOR SELECT TO "anon" USING (true);



CREATE POLICY "factures update" ON "public"."factures" FOR UPDATE TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "history delete" ON "public"."work_order_history" FOR DELETE TO "anon" USING (true);



CREATE POLICY "history insert" ON "public"."work_order_history" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "history read" ON "public"."work_order_history" FOR SELECT TO "anon" USING (true);



CREATE POLICY "history update" ON "public"."work_order_history" FOR UPDATE TO "anon" USING (true) WITH CHECK (true);



ALTER TABLE "public"."inventory" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "inventory delete" ON "public"."inventory" FOR DELETE TO "anon" USING (true);



CREATE POLICY "inventory insert" ON "public"."inventory" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "inventory movements delete" ON "public"."inventory_movements" FOR DELETE TO "anon" USING (true);



CREATE POLICY "inventory movements insert" ON "public"."inventory_movements" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "inventory movements read" ON "public"."inventory_movements" FOR SELECT TO "anon" USING (true);



CREATE POLICY "inventory movements update" ON "public"."inventory_movements" FOR UPDATE TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "inventory read" ON "public"."inventory" FOR SELECT TO "anon" USING (true);



CREATE POLICY "inventory update" ON "public"."inventory" FOR UPDATE TO "anon" USING (true) WITH CHECK (true);



ALTER TABLE "public"."inventory_movements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "mileage history delete" ON "public"."vehicle_mileage_history" FOR DELETE TO "authenticated", "anon" USING (true);



CREATE POLICY "mileage history insert" ON "public"."vehicle_mileage_history" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "mileage history select" ON "public"."vehicle_mileage_history" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "mileage history update" ON "public"."vehicle_mileage_history" FOR UPDATE TO "authenticated", "anon" USING (true) WITH CHECK (true);



CREATE POLICY "overrides_admin_delete" ON "public"."user_permission_overrides" FOR DELETE TO "authenticated" USING (("public"."current_user_role"() = 'admin'::"public"."user_role"));



CREATE POLICY "overrides_admin_insert" ON "public"."user_permission_overrides" FOR INSERT TO "authenticated" WITH CHECK (("public"."current_user_role"() = 'admin'::"public"."user_role"));



CREATE POLICY "overrides_admin_update" ON "public"."user_permission_overrides" FOR UPDATE TO "authenticated" USING (("public"."current_user_role"() = 'admin'::"public"."user_role")) WITH CHECK (("public"."current_user_role"() = 'admin'::"public"."user_role"));



CREATE POLICY "overrides_read_own_or_admin" ON "public"."user_permission_overrides" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR ("public"."current_user_role"() = 'admin'::"public"."user_role")));



CREATE POLICY "payments delete" ON "public"."work_order_payments" FOR DELETE TO "authenticated", "anon" USING (true);



CREATE POLICY "payments insert" ON "public"."work_order_payments" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "payments select" ON "public"."work_order_payments" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "payments update" ON "public"."work_order_payments" FOR UPDATE TO "authenticated", "anon" USING (true) WITH CHECK (true);



CREATE POLICY "permissions_authenticated_read" ON "public"."app_permissions" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_admin_read_all" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("public"."current_user_role"() = 'admin'::"public"."user_role"));



CREATE POLICY "profiles_admin_update_all" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("public"."current_user_role"() = 'admin'::"public"."user_role")) WITH CHECK (("public"."current_user_role"() = 'admin'::"public"."user_role"));



CREATE POLICY "profiles_read_own" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("id" = "auth"."uid"()));



ALTER TABLE "public"."role_permissions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "role_permissions_authenticated_read" ON "public"."role_permissions" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."service_catalog" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."suppliers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "suppliers delete" ON "public"."suppliers" FOR DELETE TO "anon" USING (true);



CREATE POLICY "suppliers insert" ON "public"."suppliers" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "suppliers read" ON "public"."suppliers" FOR SELECT TO "anon" USING (true);



CREATE POLICY "suppliers update" ON "public"."suppliers" FOR UPDATE TO "anon" USING (true) WITH CHECK (true);



ALTER TABLE "public"."user_permission_overrides" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "vehicle recommendations delete" ON "public"."vehicle_recommendations" FOR DELETE TO "anon" USING (true);



CREATE POLICY "vehicle recommendations insert" ON "public"."vehicle_recommendations" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "vehicle recommendations read" ON "public"."vehicle_recommendations" FOR SELECT TO "anon" USING (true);



CREATE POLICY "vehicle recommendations update" ON "public"."vehicle_recommendations" FOR UPDATE TO "anon" USING (true) WITH CHECK (true);



ALTER TABLE "public"."vehicle_mileage_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vehicle_recommendations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vehicles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "work order checklists delete" ON "public"."work_order_checklists" FOR DELETE TO "anon" USING (true);



CREATE POLICY "work order checklists insert" ON "public"."work_order_checklists" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "work order checklists read" ON "public"."work_order_checklists" FOR SELECT TO "anon" USING (true);



CREATE POLICY "work order checklists update" ON "public"."work_order_checklists" FOR UPDATE TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "work order photos delete" ON "public"."work_order_photos" FOR DELETE TO "anon" USING (true);



CREATE POLICY "work order photos insert" ON "public"."work_order_photos" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "work order photos read" ON "public"."work_order_photos" FOR SELECT TO "anon" USING (true);



CREATE POLICY "work order photos update" ON "public"."work_order_photos" FOR UPDATE TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "work order signatures delete" ON "public"."work_order_signatures" FOR DELETE TO "anon" USING (true);



CREATE POLICY "work order signatures insert" ON "public"."work_order_signatures" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "work order signatures read" ON "public"."work_order_signatures" FOR SELECT TO "anon" USING (true);



CREATE POLICY "work order signatures update" ON "public"."work_order_signatures" FOR UPDATE TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "work orders update" ON "public"."work_orders" FOR UPDATE TO "anon" USING (true) WITH CHECK (true);



ALTER TABLE "public"."work_order_checklists" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."work_order_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."work_order_labor_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."work_order_part_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."work_order_payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."work_order_photos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."work_order_signatures" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."work_orders" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."has_permission"("requested_permission" "text") TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."app_permissions" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."app_permissions" TO "authenticated";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."app_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."app_settings" TO "anon";
GRANT ALL ON TABLE "public"."app_settings" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."app_settings" TO "service_role";



GRANT ALL ON TABLE "public"."appointments" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."appointments" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."appointments" TO "service_role";



GRANT ALL ON TABLE "public"."clients" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."clients" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."clients" TO "service_role";



GRANT ALL ON TABLE "public"."company_settings" TO "anon";
GRANT ALL ON TABLE "public"."company_settings" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."company_settings" TO "service_role";



GRANT ALL ON TABLE "public"."devis" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."devis" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."devis" TO "service_role";



GRANT SELECT,USAGE ON SEQUENCE "public"."devis_seq" TO "anon";



GRANT ALL ON TABLE "public"."documents" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."documents" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."documents" TO "service_role";



GRANT ALL ON TABLE "public"."employees" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."employees" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."employees" TO "service_role";



GRANT SELECT,USAGE ON SEQUENCE "public"."facture_seq" TO "anon";



GRANT ALL ON TABLE "public"."factures" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."factures" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."factures" TO "service_role";



GRANT ALL ON TABLE "public"."inventory" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."inventory" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."inventory" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_movements" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."inventory_movements" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."inventory_movements" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profiles" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."role_permissions" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."role_permissions" TO "authenticated";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."role_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."service_catalog" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."service_catalog" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."service_catalog" TO "service_role";



GRANT ALL ON TABLE "public"."suppliers" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."suppliers" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."suppliers" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."user_permission_overrides" TO "anon";
GRANT ALL ON TABLE "public"."user_permission_overrides" TO "authenticated";
GRANT ALL ON TABLE "public"."user_permission_overrides" TO "service_role";



GRANT ALL ON TABLE "public"."vehicle_mileage_history" TO "anon";
GRANT ALL ON TABLE "public"."vehicle_mileage_history" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."vehicle_mileage_history" TO "service_role";



GRANT ALL ON TABLE "public"."vehicle_recommendations" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."vehicle_recommendations" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."vehicle_recommendations" TO "service_role";



GRANT ALL ON TABLE "public"."vehicles" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."vehicles" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."vehicles" TO "service_role";



GRANT ALL ON TABLE "public"."work_order_checklists" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."work_order_checklists" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."work_order_checklists" TO "service_role";



GRANT ALL ON TABLE "public"."work_order_history" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."work_order_history" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."work_order_history" TO "service_role";



GRANT ALL ON TABLE "public"."work_order_labor_items" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."work_order_labor_items" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."work_order_labor_items" TO "service_role";



GRANT ALL ON TABLE "public"."work_order_part_items" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."work_order_part_items" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."work_order_part_items" TO "service_role";



GRANT ALL ON TABLE "public"."work_order_payments" TO "anon";
GRANT ALL ON TABLE "public"."work_order_payments" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."work_order_payments" TO "service_role";



GRANT ALL ON TABLE "public"."work_order_photos" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."work_order_photos" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."work_order_photos" TO "service_role";



GRANT SELECT,USAGE ON SEQUENCE "public"."work_order_seq" TO "anon";



GRANT ALL ON TABLE "public"."work_order_signatures" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."work_order_signatures" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."work_order_signatures" TO "service_role";



GRANT ALL ON TABLE "public"."work_orders" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."work_orders" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."work_orders" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "service_role";







