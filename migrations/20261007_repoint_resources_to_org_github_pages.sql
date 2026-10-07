-- Repoint stored resource links from the old personal GitHub Pages host to
-- the-sandwich-project org, where these repos now live. GitHub does not
-- redirect username.github.io after a repo transfer, so the old URLs 404.
-- seed-resources.ts only inserts, so existing rows need this update.
--
-- tsp-toolkit is intentionally excluded: it has not moved to the org.
-- Idempotent: rows already on the new host no longer match the WHERE.

UPDATE resources
SET url = replace(url, 'https://nicunursekatie.github.io/', 'https://the-sandwich-project.github.io/'),
    updated_at = NOW()
WHERE url LIKE 'https://nicunursekatie.github.io/sandwichinventory/%'
   OR url LIKE 'https://nicunursekatie.github.io/sandwichprojectcollectionsites/%'
   OR url LIKE 'https://nicunursekatie.github.io/tsp-internal/%';
