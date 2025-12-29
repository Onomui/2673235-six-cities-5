#!/usr/bin/env node
import chalk from 'chalk';
import { showHelp } from './commands/help.js';
import { readVersion } from './commands/version.js';
import { importTsv } from './commands/import.js';
import { generateTsv } from './commands/generate.js';

async function main(argv: string[]): Promise<void> {
  const args = argv.slice(2);

  if (args.length === 0) {
    showHelp();
    return;
  }

  const cmd = args[0];

  if (cmd === '--help') {
    showHelp();
    return;
  }

  if (cmd === '--version') {
    const v = await readVersion();
    console.log(chalk.magenta(v));
    return;
  }

  if (cmd === '--import') {
    const path = args[1];
    if (!path) {
      console.error(chalk.red('Использование: --import <filepath>'));
      process.exitCode = 1;
      return;
    }
    await importTsv(path);
    return;
  }

  if (cmd === '--generate') {
    const nStr = args[1];
    const filePath = args[2];
    const url = args[3];

    if (!nStr || !filePath || !url) {
      console.error(chalk.red('Использование: --generate <n> <filepath> <url>'));
      process.exitCode = 1;
      return;
    }

    const n = Number(nStr);
    if (!Number.isInteger(n) || n <= 0) {
      console.error(chalk.red('n должно быть целым числом > 0'));
      process.exitCode = 1;
      return;
    }

    try {
      console.log(chalk.blueBright(`Генерация ${n} строк в ${filePath} с базы ${url} ...`));
      await generateTsv(n, filePath, url);
      console.log(chalk.green('Готово.'));
    } catch (e) {
      console.error(chalk.red('Ошибка генерации:'), (e as Error).message);
      process.exitCode = 1;
    }
    return;
  }

  console.error(chalk.red(`Неизвестная команда: ${cmd}`));
  showHelp();
  process.exitCode = 1;
}

main(process.argv).catch((err) => {
  console.error(chalk.red('Необработанная ошибка:'), err);
  process.exitCode = 1;
});
