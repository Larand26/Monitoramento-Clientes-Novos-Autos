import chalk from "chalk";

export const logger = {
  info: (message: string) => console.log(chalk.blue.bold("[Info]"), message),
  success: (message: string) =>
    console.log(chalk.green.bold("[Success]"), message),
  warning: (message: string) =>
    console.log(chalk.yellow.bold("[Warning]"), message),
  error: (message: string) =>
    console.error(chalk.red.bold.underline("[Error]"), message),
};
