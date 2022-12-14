"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getActionParams = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
const github_1 = require("./github");
const defaultActionParams = {
    github_token: '',
    incremental_files_only: true,
    files_config: '',
    cspell_config: '',
    clang_tidy_config: '.clang-tidy',
    clang_format_config: '.clang-format',
    max_diff_length: 20,
    max_duplicate_problems: 5,
    root: '',
    verbose: false,
};
function applyDefaults(params) {
    const results = Object.assign(Object.assign({}, params), { provided: {} });
    for (const [key, value] of Object.entries(defaultActionParams)) {
        results.provided[key] = !['', undefined, NaN].includes(results[key]);
        results[key] = results.provided[key] ? results[key] : value;
    }
    return results;
}
function validateToken(params) {
    const token = params.github_token;
    return !token ? 'Missing GITHUB Token' : undefined;
}
function validateConfig(key) {
    return (params) => {
        const config = params[key];
        const success = typeof config === 'string' && (!config || (0, fs_1.existsSync)((0, path_1.join)(params.root, config)));
        return !success ? `Configuration file "${config}" not found.` : undefined;
    };
}
function validateNumber(key) {
    return (params) => {
        const config = params[key];
        return !config ? `${key} must be a number greater than 0.` : undefined;
    };
}
function validateTrueFalse(key, msg) {
    return (params) => {
        const value = params[key];
        const success = typeof value === 'boolean';
        return !success ? msg : undefined;
    };
}
function validateRoot(params) {
    const root = params.root;
    const success = !root || (0, fs_1.existsSync)(root);
    return !success ? `Root path does not exist: "${root}"` : undefined;
}
const validateIncrementalFilesOnly = validateTrueFalse('incremental_files_only', 'Invalid incremental_files_only setting, must be one of (true, false)');
const validateVerbose = validateTrueFalse('verbose', 'Invalid verbose setting, must be one of (true, false)');
const validateFilesConfig = validateConfig('files_config');
const validateCSpellConfig = validateConfig('cspell_config');
const validateTidyConfig = validateConfig('clang_tidy_config');
const validateFormatConfig = validateConfig('clang_format_config');
const validateMaxDiffLength = validateNumber('max_diff_length');
const validateMaxDuplicateProblems = validateNumber('max_duplicate_problems');
function validateActionParams(params) {
    const validations = [
        validateRoot,
        validateToken,
        validateIncrementalFilesOnly,
        validateFilesConfig,
        validateCSpellConfig,
        validateTidyConfig,
        validateFormatConfig,
        validateMaxDiffLength,
        validateMaxDuplicateProblems,
        validateVerbose,
    ];
    let failed = false;
    for (const validation of validations) {
        const msg = validation(params);
        if (msg) {
            github_1.core.error(msg);
            failed = true;
        }
    }
    if (failed) {
        throw new Error('Bad Configuration.');
    }
}
function tf(v) {
    const mapValues = {
        true: true,
        t: true,
        false: false,
        f: false,
        '0': false,
        '1': true,
    };
    v = typeof v === 'boolean' || typeof v === 'number' ? (v ? 'true' : 'false') : v;
    v = v.toString();
    v = v.toLowerCase();
    v = mapValues[v] || v;
    return v === 'true' ? true : false;
}
function getActionParams() {
    const params = applyDefaults({
        github_token: github_1.core.getInput('github_token', { required: true }),
        incremental_files_only: tf(github_1.core.getInput('incremental_files_only')),
        files_config: github_1.core.getInput('files_config'),
        cspell_config: github_1.core.getInput('cspell_config'),
        clang_tidy_config: github_1.core.getInput('clang_tidy_config'),
        clang_format_config: github_1.core.getInput('clang_format_config'),
        max_diff_length: parseInt(github_1.core.getInput('max_diff_length')),
        max_duplicate_problems: parseInt(github_1.core.getInput('max_duplicate_problems')),
        root: github_1.core.getInput('root'),
        verbose: tf(github_1.core.getInput('verbose')),
    });
    validateActionParams(params);
    params.verbose = params.verbose || github_1.core.isDebug();
    return params;
}
exports.getActionParams = getActionParams;
//# sourceMappingURL=actionParams.js.map