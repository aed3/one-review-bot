"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.action = void 0;
const child_process_1 = require("child_process");
const diff_1 = require("diff");
const fs_1 = require("fs");
const path_1 = require("path");
const github_1 = require("./github");
const log_1 = require("./log");
function parseFormatOutput(newCode, details, file, params) {
    const oldCode = (0, fs_1.readFileSync)(file, 'utf8');
    const diff = (0, diff_1.structuredPatch)(file, file, oldCode, newCode, '', '', { context: 1, newlineIsToken: true });
    for (const hunk of diff.hunks) {
        let name = '';
        let message = '';
        let replacement = '';
        const lineCount = Math.max(hunk.oldLines, hunk.newLines);
        if (lineCount >= params.max_diff_length) {
            name = `${lineCount} line diff too long to display`;
            message =
                `Please run clang-format on ${file} to fix lines ${hunk.oldStart} - ${hunk.oldStart + hunk.oldLines - 1}`;
        }
        else {
            replacement = hunk.lines.join('\n').trim();
            message = `${lineCount} line difference from style guide`;
        }
        details.push({
            level: 'error',
            line: hunk.oldStart,
            col: 1,
            name,
            message,
            replacement,
        });
    }
}
const NOTE_HEADER = /^(.*):(\d+):(\d+):\s(\w+):(.*)\[(.*)\]$/;
function parseTidyOutput(result, details, file, files) {
    let detail = null;
    let replacementLines = [];
    const lines = result.split('\n');
    (0, log_1.verbose)('\t ', lines.length.toString(), 'line output from clang:');
    lines.forEach(line => (0, log_1.verbose)('\t  ' + line));
    const addDetail = () => {
        details.push(Object.assign(Object.assign({}, detail), { replacement: replacementLines.join('\n').trim() }));
        detail = null;
        replacementLines = [];
    };
    for (const line of lines) {
        if (line.startsWith(process.cwd()) && !files.includes(line.split(':')[0])) {
            addDetail();
            continue;
        }
        const match = NOTE_HEADER.exec(line);
        if (match) {
            if (detail) {
                addDetail();
            }
            detail = {
                level: match[4],
                line: parseInt(match[2]),
                col: parseInt(match[3]),
                name: match[6].trim(),
                message: match[5].trim(),
            };
            replacementLines = [];
        }
        else if (detail) {
            replacementLines.push(line);
        }
    }
    if (detail && replacementLines.length) {
        addDetail();
    }
}
function runClang(clangCmd, files, typeSuggestion, parseClangOutput, ...extraArgs) {
    return __awaiter(this, void 0, void 0, function* () {
        github_1.core.startGroup('Running ' + clangCmd[0]);
        yield Promise.all(files.map(file => {
            return new Promise(resolve => {
                let result = '';
                (0, child_process_1.exec)(clangCmd.concat(file).join(' '), (error, stdout) => {
                    (0, log_1.info)('\t', file);
                    if (error) {
                        (0, log_1.verbose)('\t\tError: ' + error.message.replace(/\n/g, '\t\n'));
                        result = error.message + '\n' + (stdout || '');
                    }
                    else {
                        result = stdout;
                    }
                    typeSuggestion[file] = [];
                    parseClangOutput(result, typeSuggestion[file], file, ...extraArgs);
                    resolve();
                });
            });
        }));
        (0, log_1.info)(clangCmd[0] + ' Compete');
        github_1.core.endGroup();
    });
}
function action(params, files) {
    return __awaiter(this, void 0, void 0, function* () {
        const issues = {};
        if (!files.length) {
            return issues;
        }
        if (params.clang_format_config) {
            issues.format = {};
            const formatCmd = ['clang-format', '--style', `file:${params.clang_format_config}`];
            yield runClang(formatCmd, files, issues.format, parseFormatOutput, params);
        }
        issues.tidy = {};
        let tidyFiles = files;
        const tidyCmd = ['clang-tidy', '-p', params.build_path];
        if (params.clang_tidy_config) {
            tidyCmd.push('--config-file', params.clang_tidy_config);
        }
        else if (!(0, fs_1.existsSync)('.clang-tidy')) {
            const uniqueDirectories = new Set(files.map(file => (0, path_1.dirname)(file)));
            const directoryHasTidyConfig = {};
            for (const directory of uniqueDirectories) {
                for (let currentDirectory = directory; true; currentDirectory = (0, path_1.dirname)(currentDirectory)) {
                    if ((0, fs_1.existsSync)((0, path_1.join)(currentDirectory, '.clang-tidy'))) {
                        directoryHasTidyConfig[directory] = true;
                        break;
                    }
                    if (currentDirectory === '.') {
                        break;
                    }
                }
            }
            tidyFiles = tidyFiles.filter(file => directoryHasTidyConfig[(0, path_1.dirname)(file)]);
        }
        (0, log_1.verbose)('Build path files:');
        (0, fs_1.readdirSync)(params.build_path).forEach(file => (0, log_1.verbose)('\t', (0, path_1.join)(params.build_path, file)));
        yield runClang(tidyCmd, tidyFiles, issues.tidy, parseTidyOutput, files.map(file => (0, path_1.join)(process.cwd(), file)));
        return issues;
    });
}
exports.action = action;
//# sourceMappingURL=clang.js.map