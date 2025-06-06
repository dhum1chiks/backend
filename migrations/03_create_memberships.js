exports.up = function (knex) {
  return knex.schema.hasTable('memberships').then((exists) => {
    if (!exists) {
      return knex.schema.createTable('memberships', (table) => {
        table.integer('team_id').notNullable().references('id').inTable('teams').onDelete('CASCADE');
        table.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
        table.timestamps(true, true);
        table.unique(['team_id', 'user_id']); // Prevent duplicate memberships
      });
    }
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('memberships');
};
