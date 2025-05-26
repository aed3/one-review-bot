import {exec} from 'child_process';
import {structuredPatch} from 'diff'
import {readdirSync, readFileSync} from 'fs';
import {join} from 'path';

import {ActionParams} from './actionParams';
import {core} from './github';
import {info, IssueLevel, verbose} from './log';
import {ClangIssueDetails, ClangTypeIssues, Issues} from './post';

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

const NOTE_HEADER = /^(.*):(\d+):(\d+):\s(\w+):(.*)\[(.*)\]$/;
function parseTidyOutput(result: string, details: ClangIssueDetails[], file: string, files: string[]) {
  let detail: Partial<ClangIssueDetails>|null = null;
  let replacementLines: string[] = [];
  const lines = result.split('\n');
  verbose('\t ', lines.length.toString(), 'line output from clang:');
  lines.forEach(line => verbose('\t  ' + line));

  const addDetail = () => {
    details.push({...detail, replacement: replacementLines.join('\n').trim()} as ClangIssueDetails);
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
        level: match[4] as IssueLevel,
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

async function runClang(clangCmd: string[],
  files: string[],
  typeSuggestion: ClangTypeIssues,
  parseClangOutput: (result: string, details: ClangIssueDetails[], file: string, ...extraArgs: any[]) => void,
  ...extraArgs: any[]) {
  core.startGroup('Running ' + clangCmd[0]);
  await Promise.all(files.map(file => {
    return new Promise<void>(resolve => {
      let result = '';
      exec(clangCmd.concat(file).join(' '), (error, stdout) => {
        info('\t', file);
        if (error) {
          verbose('\t\tError: ' + error.message.replace(/\n/g, '\t\n'));
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

  info(clangCmd[0] + ' Compete');
  core.endGroup();
}

export async function action(params: ActionParams, files: string[]): Promise<Issues> {
  const issues: Issues = {};

  if (!files.length) {
    return issues;
  }

  if (params.clang_format_config) {
    issues.format = {};
    const formatCmd = ['clang-format', '--style', `file:${params.clang_format_config}`];
    await runClang(formatCmd, files, issues.format, parseFormatOutput, params);
  }

  if (params.clang_tidy_config) {
    issues.tidy = {};
    const tidyCmd = ['clang-tidy', '-p', params.build_path];
    if (params.clang_tidy_config) {
      tidyCmd.push('--config-file', params.clang_tidy_config);
    }
    verbose('Build path files:');
    readdirSync(params.build_path).forEach(file => verbose('\t', join(params.build_path, file)));
    await runClang(tidyCmd, files, issues.tidy, parseTidyOutput, files.map(file => join(process.cwd(), file)));
  }

  return issues;
}
