exports.up = function (knex) {
  return knex.schema.hasTable('teams').then((exists) => {
    if (!exists) {
      return knex.schema.createTable('teams', (table) => {
        table.increments('id').primary();
        table.string('name').notNullable();
        table.integer('created_by').notNullable().references('id').inTable('users').onDelete('CASCADE');
        table.timestamps(true, true);
      });
    }
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('teams');
};
