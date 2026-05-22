db = db.getSiblingDB('invo-admin');

db.createCollection('projects');
db.createCollection('files');
db.createCollection('issues');
db.createCollection('notes');
db.createCollection('notifications');

print('MongoDB initialized: invo-admin database and collections created.');
