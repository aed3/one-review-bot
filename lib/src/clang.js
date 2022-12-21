"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.action = void 0;
const child_process_1 = require("child_process");
const diff_1 = require("diff");
const fs_1 = require("fs");
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
const NOTE_HEADER = /^.*:(\d+):(\d+):\s(\w+):(.*)\[(.*)\]$/;
function parseTidyOutput(result, details) {
    let detail = null;
    let replacementLines = [];
    const lines = result.split('\n');
    (0, log_1.verbose)('\t\t', lines.length.toString(), 'line output from clang');
    for (const line of lines) {
        const match = NOTE_HEADER.exec(line);
        if (match) {
            if (detail) {
                details.push(Object.assign(Object.assign({}, detail), { replacement: replacementLines.join('\n').trim() }));
            }
            detail = {
                level: match[3],
                line: parseInt(match[1]),
                col: parseInt(match[2]),
                name: match[5].trim(),
                message: match[4].trim(),
            };
            replacementLines = [];
        }
        else if (detail) {
            replacementLines.push(line);
        }
    }
}
function runClang(clangCmd, params, files, typeSuggestion, parseClangOutput) {
    var _a;
    github_1.core.startGroup('Running ' + clangCmd[0]);
    for (const file of files) {
        (0, log_1.info)('\t', file);
        let result = '';
        try {
            result = (0, child_process_1.execSync)(clangCmd.concat(file).join(' '), { stdio: 'pipe' }).toString();
        }
        catch (e) {
            result = e.message + '\n' + (((_a = e.stdout) === null || _a === void 0 ? void 0 : _a.toString()) || '');
        }
        typeSuggestion[file] = [];
        parseClangOutput(result, typeSuggestion[file], file, params);
    }
    (0, log_1.info)(clangCmd[0] + ' Compete');
    github_1.core.endGroup();
}
function action(params, files) {
    const issues = {};
    if (!files.length) {
        return issues;
    }
    if (params.clang_format_config) {
        issues.format = {};
        const formatCmd = ['clang-format', '--style', `file:${params.clang_format_config}`];
        runClang(formatCmd, params, files, issues.format, parseFormatOutput);
    }
    if (params.clang_tidy_config) {
        issues.tidy = {};
        const tidyCmd = ['clang-tidy', '--config-file', params.clang_tidy_config, '-p', params.build_path];
        runClang(tidyCmd, params, files, issues.tidy, parseTidyOutput);
    }
    return issues;
}
exports.action = action;
//# sourceMappingURL=clang.js.map