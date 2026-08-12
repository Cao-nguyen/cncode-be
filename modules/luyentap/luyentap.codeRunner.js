const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const LANGUAGE_CONFIG = {
    javascript: { ext: '.js', command: 'node', args: (file) => [file] },
    js: { ext: '.js', command: 'node', args: (file) => [file] },
    pascal: { ext: '.pas', command: 'fpc', args: (file) => [file], run: (dir, base) => path.join(dir, base.replace('.pas', '')) },
    c: { ext: '.c', command: 'gcc', args: (file, out) => [file, '-o', out], run: (dir, out) => out },
    cpp: { ext: '.cpp', command: 'g++', args: (file, out) => [file, '-o', out], run: (dir, out) => out },
};

const PYTHON_NOT_INSTALLED_MSG =
    'Máy chủ chưa cài Python 3. Admin cần cài Python từ https://python.org hoặc đặt biến môi trường PYTHON_PATH trỏ tới python.exe.';

function isPythonStubError(text = '') {
    const msg = String(text).toLowerCase();
    return msg.includes('python was not found')
        || msg.includes('microsoft store')
        || msg.includes('app execution aliases')
        || msg.includes('is not recognized as an internal or external command');
}

function findWindowsPythonExe() {
    const candidates = [];

    if (process.env.PYTHON_PATH) {
        candidates.push(process.env.PYTHON_PATH);
    }

    const localAppData = process.env.LOCALAPPDATA;
    if (localAppData) {
        const pyRoot = path.join(localAppData, 'Programs', 'Python');
        if (fs.existsSync(pyRoot)) {
            for (const dir of fs.readdirSync(pyRoot)) {
                candidates.push(path.join(pyRoot, dir, 'python.exe'));
            }
        }
    }

    for (const dir of ['C:\\Python313', 'C:\\Python312', 'C:\\Python311', 'C:\\Python310']) {
        candidates.push(path.join(dir, 'python.exe'));
    }

    return candidates.find((exe) => fs.existsSync(exe)) || null;
}

function getPythonRunners() {
    const found = process.platform === 'win32' ? findWindowsPythonExe() : null;
    if (found) {
        return [{ command: found, args: (file) => [file] }];
    }

    if (process.platform === 'win32') {
        return [
            { command: 'py', args: (file) => ['-3', file] },
            { command: 'python3', args: (file) => [file] },
            { command: 'python', args: (file) => [file] },
        ];
    }

    return [
        { command: 'python3', args: (file) => [file] },
        { command: 'python', args: (file) => [file] },
    ];
}

function normalizeOutput(text = '') {
    return String(text).trim().replace(/\r\n/g, '\n');
}

function runProcess(command, args, input = '', timeoutMs = 8000) {
    return new Promise((resolve) => {
        const child = spawn(command, args, { shell: false });
        let stdout = '';
        let stderr = '';

        const timer = setTimeout(() => {
            child.kill('SIGKILL');
            resolve({ stdout, stderr: stderr || 'Timeout', exitCode: -1 });
        }, timeoutMs);

        child.stdout.on('data', (data) => { stdout += data.toString(); });
        child.stderr.on('data', (data) => { stderr += data.toString(); });

        child.on('close', (code) => {
            clearTimeout(timer);
            resolve({ stdout, stderr, exitCode: code ?? 0 });
        });

        child.on('error', (err) => {
            clearTimeout(timer);
            resolve({ stdout: '', stderr: err.message, exitCode: -1 });
        });

        if (input) {
            child.stdin.write(input);
            child.stdin.end();
        }
    });
}

async function runPythonCode(filePath, input = '', expectedOutput = '') {
    const runners = getPythonRunners();
    let lastError = '';

    for (const runner of runners) {
        const result = await runProcess(runner.command, runner.args(filePath), input);
        const combinedError = [result.stderr, result.stdout].filter(Boolean).join('\n');

        if (isPythonStubError(combinedError) || /^spawn .* ENOENT/i.test(result.stderr || '')) {
            lastError = combinedError || result.stderr || lastError;
            continue;
        }

        const output = normalizeOutput(result.stdout);
        const passed = expectedOutput
            ? normalizeOutput(output) === normalizeOutput(expectedOutput)
            : result.exitCode === 0;
        return {
            success: result.exitCode === 0,
            output,
            error: result.stderr || '',
            passed,
            exitCode: result.exitCode,
        };
    }

    return {
        success: false,
        output: '',
        error: isPythonStubError(lastError) ? PYTHON_NOT_INSTALLED_MSG : (lastError || PYTHON_NOT_INSTALLED_MSG),
        passed: false,
        exitCode: -1,
    };
}

async function runAlgorithmCode({ language, code, input = '', expectedOutput = '' }) {
    const lang = String(language || 'python').toLowerCase();

    if (lang === 'python' || lang === 'py') {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'luyentap-'));
        const filePath = path.join(dir, 'main.py');
        try {
            fs.writeFileSync(filePath, code, 'utf8');
            return await runPythonCode(filePath, input, expectedOutput);
        } catch (err) {
            return { success: false, output: '', error: err.message, passed: false };
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    }

    const config = LANGUAGE_CONFIG[lang];
    if (!config) {
        return {
            success: false,
            output: '',
            error: `Ngôn ngữ "${language}" chưa được hỗ trợ trên server`,
            passed: false
        };
    }

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'luyentap-'));
    const fileName = `main${config.ext}`;
    const filePath = path.join(dir, fileName);

    try {
        fs.writeFileSync(filePath, code, 'utf8');

        if (config.run) {
            const outPath = path.join(dir, process.platform === 'win32' ? 'main.exe' : 'main');
            const compile = await runProcess(config.command, config.args(filePath, outPath));
            if (compile.exitCode !== 0) {
                return { success: false, output: '', error: compile.stderr || 'Biên dịch thất bại', passed: false };
            }
            const result = await runProcess(outPath, [], input);
            const output = normalizeOutput(result.stdout);
            const passed = expectedOutput
                ? normalizeOutput(output) === normalizeOutput(expectedOutput)
                : result.exitCode === 0;
            return {
                success: result.exitCode === 0,
                output,
                error: result.stderr || '',
                passed,
                exitCode: result.exitCode
            };
        }

        const result = await runProcess(config.command, config.args(filePath), input);
        const output = normalizeOutput(result.stdout);
        const passed = expectedOutput
            ? normalizeOutput(output) === normalizeOutput(expectedOutput)
            : result.exitCode === 0;

        return {
            success: result.exitCode === 0,
            output,
            error: result.stderr || '',
            passed,
            exitCode: result.exitCode
        };
    } catch (err) {
        return { success: false, output: '', error: err.message, passed: false };
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

/** Ghép JSON đa file (html/css/js) hoặc trả HTML thuần. */
function combineWebProjectCode(raw = '') {
    const trimmed = String(raw).trim();
    if (!trimmed) return '';

    if (trimmed.startsWith('{')) {
        try {
            const parsed = JSON.parse(trimmed);
            let html = typeof parsed.html === 'string' ? parsed.html : '';
            const css = typeof parsed.css === 'string' ? parsed.css : '';
            const js = typeof parsed.js === 'string' ? parsed.js : '';

            if (css.trim()) {
                const styleBlock = `<style>\n${css}\n</style>`;
                if (/<\/head>/i.test(html)) {
                    html = html.replace(/<\/head>/i, `${styleBlock}\n</head>`);
                } else {
                    html = `${styleBlock}\n${html}`;
                }
            }

            if (js.trim()) {
                const scriptBlock = `<script>\n${js}\n</script>`;
                if (/<\/body>/i.test(html)) {
                    html = html.replace(/<\/body>/i, `${scriptBlock}\n</body>`);
                } else {
                    html = `${html}\n${scriptBlock}`;
                }
            }

            return html;
        } catch {
            return trimmed;
        }
    }

    return trimmed;
}

function gradeWebCode(code, requirements = []) {
    const html = combineWebProjectCode(code) || '';
    const results = requirements.map((req) => {
        let passed = false;
        switch (req.type) {
            case 'has-tag':
                passed = new RegExp(`<${req.tag}[^>]*>`, 'i').test(html);
                break;
            case 'has-text':
                passed = req.text ? html.toLowerCase().includes(String(req.text).toLowerCase()) : false;
                break;
            case 'contains':
                passed = req.value ? html.toLowerCase().includes(String(req.value).toLowerCase()) : false;
                break;
            case 'has-style': {
                const prop = (req.property || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const val = (req.value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                passed = new RegExp(`${prop}\\s*:\\s*[^;]*${val}`, 'i').test(html);
                break;
            }
            default:
                passed = false;
        }
        return { requirement: req, passed };
    });

    const passed = results.length === 0 ? true : results.every((r) => r.passed);
    return { passed, results };
}

module.exports = {
    runAlgorithmCode,
    gradeWebCode,
    combineWebProjectCode,
    normalizeOutput
};
