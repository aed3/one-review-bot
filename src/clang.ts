import {execSync} from 'child_process';
import {structuredPatch} from 'diff'
import {readdirSync, readFileSync} from 'fs';

import {ActionParams} from './actionParams';
import {core} from './github';
import {info, IssueLevel, verbose} from './log';
import {ClangIssueDetails, ClangTypeIssues, Issues} from './post';
import {join} from 'path';

function parseFormatOutput(newCode: string, details: ClangIssueDetails[], file: string, params: ActionParams) {
  const oldCode = readFileSync(file, 'utf8');
  const diff = structuredPatch(file, file, oldCode, newCode, '', '', {context: 1, newlineIsToken: true});

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
function parseTidyOutput(result: string, details: ClangIssueDetails[]) {
  let detail: Partial<ClangIssueDetails>|null = null;
  let replacementLines: string[] = [];
  const lines = result.split('\n');
  verbose('\t ', lines.length.toString(), 'line output from clang:');
  lines.forEach(line => verbose('\t  ' + line));

  const addDetail = () => details.push({...detail, replacement: replacementLines.join('\n').trim()} as ClangIssueDetails);

  for (const line of lines) {
    const match = NOTE_HEADER.exec(line);
    if (match) {
      if (detail) {
        addDetail();
      }
      detail = {
        level: match[3] as IssueLevel,
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

  if (detail && replacementLines.length) {
    addDetail();
  }
}

function runClang(clangCmd: string[],
  params: ActionParams,
  files: string[],
  typeSuggestion: ClangTypeIssues,
  parseClangOutput: (result: string, details: ClangIssueDetails[], file: string, params: ActionParams) => void) {
  core.startGroup('Running ' + clangCmd[0]);
  for (const file of files) {
    info('\t', file);
    let result = '';
    try {
      result = execSync(clangCmd.concat(file).join(' '), {stdio: 'pipe'}).toString();
    }
    catch (e) {
      verbose('\t\tError: ' + e.message.replace(/\n/g, '\t\n'));
      result = e.message + '\n' + (e.stdout?.toString() || '');
    }

    typeSuggestion[file] = [];
    parseClangOutput(result, typeSuggestion[file], file, params);
  }
  info(clangCmd[0] + ' Compete');
  core.endGroup();
}

export function action(params: ActionParams, files: string[]): Issues {
  const issues: Issues = {};

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
    verbose('Build path files:');
    readdirSync(params.build_path).forEach(file => verbose('\t', join(params.build_path, file)));
    runClang(tidyCmd, params, files, issues.tidy, parseTidyOutput);
  }

  return issues;
}
