import { InputBoxOptions, window } from 'vscode';
import { chmodSync } from 'fs';
import * as sudo from 'sudo-prompt';

const permissionsParser = (value: string): string | undefined => {
    if (value.length === 3) {
        return value.match(/^[0-7][0-7][0-7]$/) ? value : undefined;
    }

    if (value.length === 9) {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        const map: { [char: string]: number } = { 'r': 4, 'w': 2, 'x': 1, '-': 0 };

        return value.match(/^([r-][w-][x-]){3}$/)
            ? (map[value[0]] + map[value[1]] + map[value[2]]).toString()
            + (map[value[3]] + map[value[4]] + map[value[5]]).toString()
            + (map[value[6]] + map[value[7]] + map[value[8]]).toString()
            : undefined;
    }

    return undefined;
};

export default class {
    public async changePermissions(): Promise<boolean | undefined> {
        if (!window.activeTextEditor) {
            return undefined;
        }

        const path = window.activeTextEditor.document.fileName;
        const boxAttributes: InputBoxOptions = {
            placeHolder: 'E.g. 644 or rw-r--r--',
            title: `New permissions for ${path}`,
            prompt: '3 digits notation or 9 letters/dash notation',
        };

        const input = await window.showInputBox(boxAttributes);
        if (input === undefined) {
            return input;
        }

        const mode = permissionsParser(input);
        if (mode === undefined) {
            window.showErrorMessage(`Invalid permissions: ${input}`);
            return false;
        }

        try {
            chmodSync(path, mode);

            return true;
        } catch (e) {
            console.log(e);

            return this.retryAsSudo(path, mode);
        }
    }

    private async retryAsSudo(path: string, mode: string): Promise<boolean> {
            const error = "Failed to save '%s': File is read-only. Select 'Execute as Sudo' to retry as superuser.";
            const sel = await window.showErrorMessage(
                error.replace('%s', path),
                { sudo: true, title: 'Execute as Sudo...' },
                { sudo: false, title: 'Discard', isCloseAffordance: true }
            );

            if (!sel || !sel.sudo) {
                return false;
            }

        return new Promise<boolean>((resolve, reject) => {
            const cmd = `chmod ${mode} ${path}`;
            const config = { name: 'Authentication' };

            sudo.exec(cmd, config, (error, stdout, stderr) => {
                if (error) {
                    window.showErrorMessage(error.message);
                    reject(false);
                } else if (stderr) {
                    window.showErrorMessage(stderr.toString());
                    reject(false);
                } else {
                    resolve(true);
                }
            });
        });
    }
}
