#!/usr/bin/env node
import { program }  from 'commander';
import inquirer from 'inquirer';
import chalkAnimation from 'chalk-animation';
import Generator from './generator.js'

const pool = []

program.version('Version is not defined!', '-v, --version');

program
  .command('init')
  .description('Initialize wolfkit')
  .action(async () => {
    await checkAvailableGenerators()
    await welcome();
    const answer = await getFramework();
    Generator[answer].gen();
  });

program
  .command('migrate')
  .description('Generate Migration files from diagram.txt')
  .action(async () => {
    await checkAvailableGenerators()
    const answer = await getFramework();

    //Select if you want to generate model or migration or both
    const option = await inquirer.prompt({
      name: 'option',
      type: 'list',
      message: 'Select your option...\n',
      choices: ['Models', 'Migrations', 'Both']
    })

    Generator[answer].build(option);
  });

program
  .command('pull')
  .description('Pull Migration files from database')
  .action(async () => {
    await checkAvailableGenerators()
    const answer = await getFramework();

    const use_file = await inquirer.prompt({
      name: 'use_file',
      type: 'confirm',
      message: 'Do you want to use connection.json?'
    })

    await Generator[answer].pull(use_file);
  });

program.parse(process.argv);

async function checkAvailableGenerators() {
  for (const generator in Generator) {
    pool.push(generator);
  }

  return pool;
}

async function welcome() {
  let str = 'Beware of the wolf... \n'
  const title = chalkAnimation.glitch(str);
  const sleep = (ms = 2000) => new Promise(resolve => setTimeout(resolve, ms));

  await sleep(1000);
  title.stop();
  title.replace(' ');
}

async function getFramework() {
  const answer = await inquirer.prompt({
    name: 'framework',
    type: 'list',
    message: 'Select your target framework...\n',
    choices: pool
  })

  return answer.framework;
}