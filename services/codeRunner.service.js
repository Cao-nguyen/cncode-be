const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class CodeRunner {
    constructor() {
        this.timeout = 5000; // 5 giây timeout
    }

    async runJavaScript(code, input = '') {
        const sessionId = uuidv4();
        const tempDir = path.join('/tmp', sessionId);

        try {
            await fs.mkdir(tempDir, { recursive: true });

            // Tạo file code.js
            const codePath = path.join(tempDir, 'code.js');
            await fs.writeFile(codePath, code);

            // Tạo file input.txt
            const inputPath = path.join(tempDir, 'input.txt');
            await fs.writeFile(inputPath, input);

            // Chạy code với input từ file
            const command = `node ${codePath} < ${inputPath}`;

            return new Promise((resolve) => {
                exec(command, { timeout: this.timeout }, (error, stdout, stderr) => {
                    this.cleanup(tempDir);

                    if (error) {
                        resolve({ output: stderr || error.message, error: true });
                    } else {
                        resolve({ output: stdout, error: false });
                    }
                });
            });
        } catch (err) {
            await this.cleanup(tempDir);
            return { output: err.message, error: true };
        }
    }

    async runPython(code, input = '') {
        const sessionId = uuidv4();
        const tempDir = path.join('/tmp', sessionId);

        try {
            await fs.mkdir(tempDir, { recursive: true });

            const codePath = path.join(tempDir, 'code.py');
            await fs.writeFile(codePath, code);

            const inputPath = path.join(tempDir, 'input.txt');
            await fs.writeFile(inputPath, input);

            const command = `python3 ${codePath} < ${inputPath}`;

            return new Promise((resolve) => {
                exec(command, { timeout: this.timeout }, (error, stdout, stderr) => {
                    this.cleanup(tempDir);

                    if (error) {
                        resolve({ output: stderr || error.message, error: true });
                    } else {
                        resolve({ output: stdout, error: false });
                    }
                });
            });
        } catch (err) {
            await this.cleanup(tempDir);
            return { output: err.message, error: true };
        }
    }

    async runCpp(code, input = '') {
        const sessionId = uuidv4();
        const tempDir = path.join('/tmp', sessionId);

        try {
            await fs.mkdir(tempDir, { recursive: true });

            const codePath = path.join(tempDir, 'code.cpp');
            const outputPath = path.join(tempDir, 'code.out');

            await fs.writeFile(codePath, code);

            // Compile C++
            const compileCommand = `g++ ${codePath} -o ${outputPath}`;

            await new Promise((resolve, reject) => {
                exec(compileCommand, { timeout: 10000 }, (error, stdout, stderr) => {
                    if (error) reject(new Error(stderr || error.message));
                    else resolve();
                });
            });

            // Chạy code
            const inputPath = path.join(tempDir, 'input.txt');
            await fs.writeFile(inputPath, input);

            const runCommand = `${outputPath} < ${inputPath}`;

            return new Promise((resolve) => {
                exec(runCommand, { timeout: this.timeout }, (error, stdout, stderr) => {
                    this.cleanup(tempDir);

                    if (error) {
                        resolve({ output: stderr || error.message, error: true });
                    } else {
                        resolve({ output: stdout, error: false });
                    }
                });
            });
        } catch (err) {
            await this.cleanup(tempDir);
            return { output: err.message, error: true };
        }
    }

    async runHTML(code) {
        // HTML chỉ trả về code, không chạy thực tế
        return {
            output: "HTML không thể chạy trên server. Mở trình duyệt để xem kết quả.",
            error: false
        };
    }

    async runCSS(code) {
        return {
            output: "CSS không thể chạy trên server. Mở trình duyệt để xem kết quả.",
            error: false
        };
    }

    async cleanup(dir) {
        try {
            await fs.rm(dir, { recursive: true, force: true });
        } catch (err) {
            console.error('Cleanup error:', err);
        }
    }

    async run(language, code, input = '') {
        switch (language) {
            case 'javascript':
                return this.runJavaScript(code, input);
            case 'python':
                return this.runPython(code, input);
            case 'cpp':
                return this.runCpp(code, input);
            case 'html':
                return this.runHTML(code);
            case 'css':
                return this.runCSS(code);
            default:
                return { output: `Ngôn ngữ ${language} chưa được hỗ trợ`, error: true };
        }
    }
}

module.exports = new CodeRunner();