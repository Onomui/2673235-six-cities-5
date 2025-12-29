import chalk from 'chalk';

export function showHelp(): void {
  console.log(chalk.cyan.bold('Программа для подготовки данных для REST API сервера.'));
  console.log('');
  console.log(chalk.gray('Пример: cli.js --<command> [--arguments]'));
  console.log('');
  console.log('Команды:');
  console.log(`  ${chalk.green('--version')}                        # номер версии`);
  console.log(`  ${chalk.green('--help')}                           # этот текст`);
  console.log(`  ${chalk.green('--import <filepath>')}              # импорт TSV в MongoDB`);
  console.log(`  ${chalk.green('--generate <n> <filepath> <url>')}  # генерировать TSV из шаблонов JSON-сервера`);
  console.log('');
}
