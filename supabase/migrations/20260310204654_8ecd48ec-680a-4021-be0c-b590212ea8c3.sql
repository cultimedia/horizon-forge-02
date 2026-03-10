
-- Rename Family Support → Human Relations and add description
UPDATE horizons SET name = 'Human Relations', description = 'Family, friends, relationships. Sarah, Mom, Dad, Maddox, Maggie, Russell (brother), Martha (his wife), Lindsey (sister), Alexus (niece), Emma (niece), Mason (nephew), Madison (his wife), Tammy (friend). Birthdays, visits, emotional support, family logistics.' WHERE id = '471a06b2-5dee-42e0-b7d9-a56e4bf910e5';

-- Add descriptions to existing horizons
UPDATE horizons SET description = 'AI, automation, consulting, HolyHell.io, OpenBrain, OpenClaw. Active projects and client work in the technology space.' WHERE id = 'bb42f36c-8205-4be7-991d-92d1fb0de0fe';
UPDATE horizons SET description = 'House construction, land clearing, shop build, and physical building projects on the property.' WHERE id = '6e28f4e0-33b9-4bad-971e-3a4a2f574afd';
UPDATE horizons SET description = 'Garden, seeds, livestock, household maintenance, supplies, and domestic systems.' WHERE id = 'f02d5e3f-798a-454e-bae4-a3fbdaa76fc1';

-- Add new horizons (using same user_id)
INSERT INTO horizons (user_id, name, description, sort_order) 
SELECT user_id, 'Financial / Legal', 'Etsy shop, POH LLC, cannabis property, invoices, income, rent, taxes, legal matters, business finances.', 4
FROM horizons WHERE id = '471a06b2-5dee-42e0-b7d9-a56e4bf910e5';

INSERT INTO horizons (user_id, name, description, sort_order)
SELECT user_id, 'Body / Health', 'Physical health, medical appointments, bloodwork, injuries, cooking nutrition, exercise, body maintenance.', 5
FROM horizons WHERE id = '471a06b2-5dee-42e0-b7d9-a56e4bf910e5';

INSERT INTO horizons (user_id, name, description, sort_order)
SELECT user_id, 'Learning / Research', 'Reading, research, self-education, papers, architecture deep-dives, skill acquisition. Pure input and learning, not active project work.', 6
FROM horizons WHERE id = '471a06b2-5dee-42e0-b7d9-a56e4bf910e5';
