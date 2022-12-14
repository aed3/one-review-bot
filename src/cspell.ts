import type {CSpellReporter, Issue as CSpellIssue, MessageType, ProgressItem, ProgressFileComplete} from '@cspell/cspell-types';
import {CSpellApplicationOptions, lint} from 'cspell';
import {readFileSync, writeFileSync} from 'fs';
import {relative} from 'path';
import {URI} from 'vscode-uri';

import {ActionParams} from './actionParams';
import {core} from './github';
import {debug, info, verbose} from './log';
import {Issues} from './post';

class CSpellReporterForGithubAction {
  readonly issues: Issues = {spelling: {}};
  readonly cspellIssues: CSpellIssue[] = [];
  readonly issueCounts = new Map<string, number>();
  readonly root = process.cwd();

  constructor(readonly verbose: boolean) {
  }

  _issue(issue: CSpellIssue) {
    const {cspellIssues, issueCounts} = this;
    const uri = issue.uri;
    uri && issueCounts.set(uri, (issueCounts.get(uri) || 0) + 1);
    cspellIssues.push(issue);
  }

  _info(message: string, _msgType: MessageType) {
    verbose(message);
  }

  _debug(message: string) {
    debug(message);
  }

  _progress(progress: ProgressItem|ProgressFileComplete) {
    if (progress.type !== 'ProgressFileComplete') return;

    if (this.verbose) {
      const issueCount = this.issueCounts.get(progress.filename) || 0;
      const {fileNum, fileCount, filename, elapsedTimeMs} = progress;
      const issues = issueCount ? ` issues: ${issueCount}` : '';
      const timeMsg = elapsedTimeMs ? `(${elapsedTimeMs.toFixed(2)}ms)` : '-';
      verbose(`${fileNum}/${fileCount} ${filename}${issues} ${timeMsg}`);
    }
    else {
      info('\t', relative(this.root, progress.filename));
    }
  }

  _error(message: string, error: Error) {
    core.error(`${message}
        name: ${error.name}
        msg: ${error.message}
        stack: ${error.stack}`);
  }

  async _result() {
    for (const item of this.cspellIssues) {
      const {suggestions, text: word} = item;
      const file = relative(this.root, URI.parse(item.uri || '').fsPath);
      const id = word.toLowerCase();

      this.issues.spelling[file] = this.issues.spelling[file] || {};
      this.issues.spelling[file][id] = this.issues.spelling[file][id] || {word, suggestions, instances: []};

      this.issues.spelling[file][id].instances.push({
        line: item.row,
        col: item.col,
        replacement: [item.line.text, '^'.padEnd(item.length, '~').padStart(item.col + item.length - 1)].join('\n'),
      });
    }
  }

  readonly reporter: CSpellReporter = {
    debug: (...args) => this._debug(...args),
    error: (...args) => this._error(...args),
    info: (...args) => this._info(...args),
    issue: (...args) => this._issue(...args),
    progress: (...args) => this._progress(...args),
    result: () => this._result(),
  };
}

export async function action(params: ActionParams, files: string[]): Promise<Issues> {
  if (!files.length) {
    return {};
  }
  core.startGroup('Running cspell');

  const collector = new CSpellReporterForGithubAction(params.verbose);
  const options: CSpellApplicationOptions = {
    root: process.cwd(),
    config: params.cspell_config || undefined,
    showSuggestions: true,
    silent: true,
  };
  verbose('CSpellApplicationOptions:', JSON.stringify(options));

  const configFileEdit = {};
  let originalConfigFile = '';
  const addParamsToConfig = !!(params.provided?.max_duplicate_problems && options.config);

  if (addParamsToConfig) {
    originalConfigFile = readFileSync(options.config, 'utf8');
    Object.assign(
      configFileEdit, JSON.parse(originalConfigFile), {maxDuplicateProblems: params.max_duplicate_problems});
    writeFileSync(options.config, JSON.stringify(configFileEdit));
  }

  try {
    await lint(files, options, collector.reporter);
  }
  catch (e) {
    core.error(e);
  }

  if (addParamsToConfig) {
    writeFileSync(options.config, originalConfigFile);
  }

  info('cspell Complete');
  core.endGroup();
  return collector.issues;
}
