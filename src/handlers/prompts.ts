export const promptUser = async (question: string): Promise<string> => {
    const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        readline.question(question, (answer: string) => {
            readline.close();
            resolve(answer);
        });
    });
};

export const confirmAction = async (action: string): Promise<boolean> => {
    const response = await promptUser(`Are you sure you want to ${action}? (yes/no) `);
    return response.toLowerCase() === 'yes';
};

export const displayMessage = (message: string): void => {
    console.log(message);
};