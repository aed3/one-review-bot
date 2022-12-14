import {existsSync} from 'fs';
import {join} from 'path';

import {core} from './github'

export interface ActionParams {
  github_token: string;
  incremental_files_only: boolean;
  files_config: string;
  cspell_config: string;
  clang_tidy_config: string;
  clang_format_config: string;
  max_diff_length: number;
  max_duplicate_problems: number
  root: string;
  /**
   * Increases the amount of information logged during the action.
   * true - show progress
   * false - less information
   * @default 'false'
   */
  verbose: boolean;

  provided?: {[key in keyof ActionParams]?: boolean};
}

const defaultActionParams: ActionParams = {
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

type ValidationFunction = (params: ActionParams) => string|undefined;

function applyDefaults(params: ActionParams): ActionParams {
  const results = {...params, provided: {}};
  for (const [key, value] of Object.entries(defaultActionParams)) {
    results.provided[key] = !['', undefined, NaN].includes(results[key]);
    results[key] = results.provided[key] ? results[key] : value;
  }
  return results;
}

function validateToken(params: ActionParams) {
  const token = params.github_token;
  return !token ? 'Missing GITHUB Token' : undefined;
}

function validateConfig(key: keyof ActionParams) {
  return (params: ActionParams) => {
    const config = params[key];
    const success = typeof config === 'string' && (!config || existsSync(join(params.root, config)));
    return !success ? `Configuration file "${config}" not found.` : undefined;
  }
}

function validateNumber(key: keyof ActionParams) {
  return (params: ActionParams) => {
    const config = params[key];
    return !config ? `${key} must be a number greater than 0.` : undefined;
  }
}

function validateTrueFalse(key: keyof ActionParams, msg: string): ValidationFunction {
  return (params: ActionParams) => {
    const value = params[key];
    const success = typeof value === 'boolean';
    return !success ? msg : undefined;
  };
}


function validateRoot(params: ActionParams) {
  const root = params.root;
  const success = !root || existsSync(root);
  return !success ? `Root path does not exist: "${root}"` : undefined;
}

const validateIncrementalFilesOnly =
  validateTrueFalse('incremental_files_only', 'Invalid incremental_files_only setting, must be one of (true, false)');
const validateVerbose = validateTrueFalse('verbose', 'Invalid verbose setting, must be one of (true, false)');

const validateFilesConfig = validateConfig('files_config');
const validateCSpellConfig = validateConfig('cspell_config');
const validateTidyConfig = validateConfig('clang_tidy_config');
const validateFormatConfig = validateConfig('clang_format_config');
const validateMaxDiffLength = validateNumber('max_diff_length');
const validateMaxDuplicateProblems = validateNumber('max_duplicate_problems');

function validateActionParams(params: ActionParams) {
  const validations: ValidationFunction[] = [
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
      core.error(msg);
      failed = true;
    }
  }

  if (failed) {
    throw new Error('Bad Configuration.');
  }
}

function tf(v: string|boolean|number): boolean {
  const mapValues: Record<string, boolean> = {
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

export function getActionParams(): ActionParams {
  const params = applyDefaults({
    github_token: core.getInput('github_token', {required: true}),
    incremental_files_only: tf(core.getInput('incremental_files_only')),
    files_config: core.getInput('files_config'),
    cspell_config: core.getInput('cspell_config'),
    clang_tidy_config: core.getInput('clang_tidy_config'),
    clang_format_config: core.getInput('clang_format_config'),
    max_diff_length: parseInt(core.getInput('max_diff_length')),
    max_duplicate_problems: parseInt(core.getInput('max_duplicate_problems')),
    root: core.getInput('root'),
    verbose: tf(core.getInput('verbose')),
  });

  validateActionParams(params);
  params.verbose = params.verbose || core.isDebug();

  return params;
}
