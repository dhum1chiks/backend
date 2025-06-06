exports.up = function (knex) {
  return knex.schema.hasTable('session').then((exists) => {
    if (!exists) {
      return knex.schema.createTable('session', (table) => {
        table.string('sid').primary();
        table.json('sess').notNullable();
        table.timestamp('expire').notNullable().index();
      });
    }
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('session');
};
