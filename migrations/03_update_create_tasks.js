exports.up = function (knex) {
  return knex.schema.hasTable('tasks').then((exists) => {
    if (!exists) {
      return knex.schema.createTable('tasks', (table) => {
        table.increments('id').primary();
        table.string('title').notNullable();
        table.text('description');
        table.integer('team_id').notNullable().references('id').inTable('teams').onDelete('CASCADE');
        table.integer('assigned_to_id').references('id').inTable('users').onDelete('SET NULL');
        table.integer('assigned_by_id').references('id').inTable('users').onDelete('SET NULL');
        table.integer('created_by').notNullable().references('id').inTable('users').onDelete('CASCADE');
        table.timestamp('due_date');
        table.string('status').defaultTo('To Do'); // Align with frontend/backend: To Do, In Progress, Done
        table.timestamps(true, true);
      });
    }
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('tasks');
};
