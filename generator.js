import fs from 'fs-extra';
import { createSpinner } from 'nanospinner'
import inquirer from 'inquirer';
import knex from 'knex';


export default {
    adonis4: {
        gen: async () => {
            //Check if project is an adonis project and folder database exists
            const checkDatabase = await fs.exists('./database/migrations')

            if (!checkDatabase) {
                createSpinner('./database/migrations is missing').error()
                return
            }
            createSpinner('Check exist  ./database/migrations').success()

            const checkModels = await fs.exists('./app/Models')
            if (!checkModels) {
                createSpinner('./app/Models is missing').error()
                return
            }
            createSpinner('Check exist  ./app/Models').success()

            const checkRoutes = await fs.exists('./app/Controllers/Http')
            if (!checkRoutes) {
                createSpinner('./app/Controllers/Http is missing').error()
                return
            }
            createSpinner('Check exist  ./app/Controllers/Http').success()

            await fs.ensureFile('./database/wolfkit/diagram.txt')
            createSpinner('Created txt file at `database/wolfkit/diagram.txt`').success()
    console.log(`
    Next Step:
    1. Copy and Paste your ${'`Diagram Code`'} from https://eraser.io/ to the file (only Data Entity)
    2. Run ${'`wolfkit mig -f adonis4`'} to generate Migration, Model and Route files
    `);
        },
        build: async ({ option }) => {
            //If file exists, read file and generate migration files
            const diagram = './database/wolfkit/diagram.txt'
            const checkDatabase = await fs.exists('./database/migrations')
            const checkModels = await fs.exists('./app/Models')
            const checkRoutes = await fs.exists('./app/Controllers/Http')

            const allow = checkDatabase && checkModels && checkRoutes
            const fileExist = await fs.exists(diagram)
            
            if (fileExist && allow) {
                fs.readFile(diagram, 'utf8', (err, data) => {
                    if (err) {
                        console.error(`Error reading file: ${err}`);
                        return;
                    }
    
                    const tables = convertTxtToTablesArray(data);
                    const relationships = [];
                    for (var i=0; i<tables.length; i++) {
                        const { name, columns } = tables[i];
                        relationships.push({ name, columns, hasMany: [], belongsTo: [] });
                        columns.forEach((column) => {
                            if (column.includes('_id')) {
                                const parentModel = column.split('_id')[0];

                                if (relationships.length) {
                                    const target = relationships.find(
                                        (relationship) => relationship.name === parentModel
                                    );
                                    if (target) {
                                        target.hasMany.push(name);
                                        relationships[i].belongsTo.push(parentModel);
                                    }
                                }
                            }
                        });
                    }
                    
                    if (option == 'Models') {
                        generateModelsFiles(relationships)

                    } else if (option == 'Migrations') {
                        generateMigrationFiles(tables)

                    } else if (option == 'Both') {
                        generateMigrationFiles(tables)
                        generateModelsFiles(relationships)
                    }

                });
            }

            function generateMigrationFiles (tables) {
                // Generate migration files
                for (var i = 0; i < tables.length; i++) {
                    const { name, columns } = tables[i];
                    const migrationContent = convertToMigrationContent(name, columns);

                    fs.writeFile(
                        `./database/migrations/${name}.js`,
                        migrationContent,
                        callBack
                    );
                }

                createSpinner(`Generated ${tables.length} migration files.`).success()
            }

            function generateModelsFiles (relationships) {
                // Generate model files
                for (var i = 0; i < relationships.length; i++) {
                    const { name, hasMany, belongsTo, columns } = relationships[i];
                    const modelContent = generateModel(name, {
                        hasMany,
                        belongsTo,
                        columns,
                    });

                    fs.writeFileSync(
                        `./app/Models/${snakeToCamel(name)}.js`,
                        modelContent,
                        callBack
                    );
                }
                createSpinner(`Generated ${relationships.length} model files.`).success()
            }

            createSpinner('wolfkit/diagram.txt file not found. Please run `wolfkit init` first.').error()
            return;
        },
        pull: async ({ use_file }) => {
            //If file exists, read file and generate migration files
            const diagram = './database/wolfkit/diagram.txt'
            var selected_db = {
                db: ''
            }
            var host = {
                host: ''
            }
            var port = {
                port: ''
            }
            var user = {
                user: ''
            }
            var password = {
                password: ''
            }
            var database = {
                database: ''
            }

            if (use_file) {
                console.log('Using connection file from ./wolfkit/connection.json');
                var connection = await fs.readJson('./database/wolfkit/connection.json')

                selected_db.db = connection.db;
                host.host = connection.host;
                port.port = connection.port;
                user.user = connection.user;
                password.password = connection.password;
                database.database = connection.database;

            } else {
                selected_db = await inquirer.prompt({
                    name: 'db',
                    type: 'list',
                    message: 'Select your Database...\n',
                    choices: [ 'mysql' ]
                })
                
                host = await inquirer.prompt({
                    name: 'host',
                    type: 'input',
                    message: 'Enter your host...\n',
                    default: 'localhost'
                })
    
                port = await inquirer.prompt({
                    name: 'port',
                    type: 'input',
                    message: 'Enter your port...\n',
                    default: '3306'
                })
    
                user = await inquirer.prompt({
                    name: 'user',
                    type: 'input',
                    message: 'Enter your user...\n',
                    default: 'root'
                })
    
                password = await inquirer.prompt({
                    name: 'password',
                    type: 'password',
                    message: 'Enter your password...\n',
                    default: ''
                })
    
                database = await inquirer.prompt({
                    name: 'database',
                    type: 'input',
                    message: 'Enter your database...\n',
                    default: ''
                })
            }

            const connectionDetail = {
                client: selected_db.db,
                connection: {
                    host: host.host,
                    port: port.port,
                    user: user.user,
                    password: password.password,
                    database: database.database
                }
            }
            
            createSpinner('Connecting to database...').spin()
            console.log(connectionDetail);
            
            const connect = knex(connectionDetail)

            const tables = await connect.raw('show tables')
                .catch((err) => {
                    console.log('Connection Error');
                })

            if (tables) {
                createSpinner(`Found ${tables[0].length} Tables, Generating Diagram Code...`).success()
            
                const tablesArray = [];
                //For each table, collect tables
                for (var i = 0; i < tables[0].length; i++) {
                    const table = tables[0][i]
                    const tableName = Object.values(table)[0]
                    const columns = await connect.raw(`show columns from ${tableName}`).catch((err) => {
                        // console.log(err);
                    })

                    const tableData = getTableData(tableName, columns[0]);
                    tablesArray.push(tableData)
                    createSpinner(`Generated (${i+1}/${tables[0].length})`).spin()
                }
                
                const diagramContent = convertTablesArrayToTxt(tablesArray);
                fs.writeFile(diagram, diagramContent, callBack);
                createSpinner('Generated diagram.txt').success()
            } else {
                createSpinner('Connection Error').error()
            }
        }
    }
}

function generateModel(name, { hasMany, belongsTo, columns }) {
    const modelContent = `'use strict'

const Model = use('Model')
${columns.includes('password string')? `const Hash = use('Hash')`: ``}
class ${snakeToCamel(name)} extends Model {
${columns.includes('notimestamp')? 
`
    static boot () {
        super.boot()
        this.addTrait('NoTimestamp')
${columns.includes('password string')? `        this.addHook('beforeSave', async (modelInstance) => {
            if (modelInstance.dirty.password) {
                modelInstance.password = await Hash.make(modelInstance.password)
            }
        })`:
``}
    }`:
`   static boot () {
        super.boot()${columns.includes('password string')? `
        this.addHook('beforeSave', async (modelInstance) => {
            if (modelInstance.dirty.password) {
                modelInstance.password = await Hash.make(modelInstance.password)
            }
        })`:
``}
    }
    
    static get dates() {
        return super.dates.concat(['created_at', 'updated_at'])
    }`
}
    ${generateRelationships(hasMany, belongsTo)}
}

module.exports = ${snakeToCamel(name)}
`;
    return modelContent;
}

function generateRelationships(hasMany, belongsTo) {
    const relationships = [];

    hasMany.forEach((relatedModel) => {
        relationships.push(`
    ${toPlural(relatedModel)}() {
        return this.hasMany('App/Models/${snakeToCamel(relatedModel)}')
    }`);
});

    belongsTo.forEach((relatedModel) => {
        relationships.push(`
    ${relatedModel}() {
        return this.belongsTo('App/Models/${snakeToCamel(relatedModel)}')
    }`);
});

    return relationships.join('\n');
}

function convertToMigrationContent(tableName, columns) {
    const migrationContent = `const Schema = use('Schema')

class ${snakeToCamel(tableName)}Schema extends Schema {
    up() {
        this.create('${toPlural(tableName)}', (table) => {
            ${columns.filter((column) => {
                const [columnName, columnType, optional] = column.split(' ');
                return columnName != 'notimestamp';
            }).map((column) => {
                const [columnName, columnType, optional] = column.split(' ');
    if (columnType === 'integer' && column.includes('pk')) {
    return `table.increments('${columnName}')`;
    } else if (optional) {
    return `            table.${columnType}('${columnName}', ${optional})`;
    } else {
    return `            table.${columnType}('${columnName}')`;
    }
    })
    .join('\n')}
    ${
        columns.includes('notimestamp')? `
            table.boolean('deleted').defaultTo(false)`:`
            table.timestamps()
            table.boolean('deleted').defaultTo(false)`
    }
        })
    }

    down() {
        this.drop('${toPlural(tableName)}')
    }
}

module.exports = ${snakeToCamel(tableName)}Schema
`;

    return migrationContent;
}

function toPlural(singular) {
    if (
        singular.endsWith('s') ||
        singular.endsWith('x') ||
        singular.endsWith('z')
    ) {
        return singular + 'es';
    } else if (singular.endsWith('y')) {
        return singular.slice(0, -1) + 'ies';
    } else {
        return singular + 's';
    }
}

function snakeToCamel(input) {
    return input
        .replace(/_([a-z])/g, function (match, group) {
            return group.toUpperCase();
        })
        .replace(/^\w/, (c) => c.toUpperCase());
}

function convertTxtToTablesArray(txt) {
    const tablesArray = [];
    const lines = txt
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line !== '');

    let currentTable = null;
    let currentColumns = [];

    for (const line of lines) {
        if (line.endsWith('{')) {
            // Start of a new table definition
            if (currentTable !== null) {
                tablesArray.push({ name: currentTable, columns: currentColumns });
                currentColumns = [];
            }
            currentTable = line.replace('{', '').trim();
        } else if (line === '}') {
            // End of the current table definition
            if (currentTable !== null) {
                tablesArray.push({ name: currentTable, columns: currentColumns });
                currentTable = null;
                currentColumns = [];
            }
        } else {
            // Column definition
            currentColumns.push(line);
        }
    }

    return tablesArray;
}

function convertTablesArrayToTxt(tablesArray) {
    const diagramContent = tablesArray
        .map((table) => {
            const { name, columns } = table;
            const diagramContent = `
${name} {
${columns
    .map((column) => {
        return `    ${column}`;
    })
    .join('\n')}
}
    `;
            return diagramContent;
        }
        )

    return diagramContent.join('\n')
}

function callBack(err) {
    if (err) {
        console.error(`Error writing file: ${err}`);
        return;
    }
}

function getTableData(tableName, columns) {
    const modifier = {
        int: 'integer',
        varchar: 'string',
        text: 'text',
        datetime: 'datetime',
        tinyint: 'boolean',
    }
    const model = {
        name: tableName,
        columns: []
    }

    columns.forEach((column) => {
        const type = Object.keys(modifier).find((key) => column.Type.includes(key))
        model.columns.push(`${column.Field} ${modifier[type]} ${column.Extra === 'auto_increment'? 'pk': ''}`.trim())
    })

    if (!model.columns.includes('created_at datetime') && !model.columns.includes('updated_at datetime')) {
        model.columns.push('notimestamp')
    } else {
        model.columns.splice(model.columns.indexOf('created_at datetime'), 1)
        model.columns.splice(model.columns.indexOf('updated_at datetime'), 1)
    }

    return model
}