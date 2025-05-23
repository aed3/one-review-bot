
import {extname} from 'path'

import {ContextInstance, GitHubInstance} from './github';
import {AnnotationProperties, info, IssueLevel, verbose} from './log';

type ClangType = 'tidy'|'format';
type IssueType = 'spelling'|ClangType;

export interface IssueDetails {
  line: number;
  col: number;
  replacement: string;
}

export interface ClangIssueDetails extends IssueDetails {
  level: IssueLevel;
  name: string;
  message: string;
}

export interface WordSpellingIssues {
  word: string;
  suggestions: string[];
  instances: IssueDetails[];
}

export interface SpellingTypeIssues {
  [filename: string]: {[word: string]: WordSpellingIssues};
}

export interface ClangTypeIssues {
  [filename: string]: ClangIssueDetails[];
}

export interface Issues {
  spelling?: SpellingTypeIssues;
  tidy?: ClangTypeIssues;
  format?: ClangTypeIssues;
}

export function pluralize(word: string, num: number) {
  return `${num} ${word}${num === 1 ? '' : 's'}`;
}

function escape(str: string) {
  return str.replace(/</g, '\\<').replace(/>/g, '\\>');
}

function toTitleCase(str: string) {
  return str[0].toUpperCase() + str.substring(1);
}

function typeHeader(emoji: string, totalIssues: number, type: IssueType, ranCmd: string) {
  return `## :${emoji}: Found ${pluralize(type + ' issue', totalIssues)} using \`${ranCmd}\``;
}

function summary(str: string) {
  return `<summary>${str}</summary>`;
}

function issueLocation(file: string, issue: IssueDetails) {
  return `${file}:${issue.line}:${issue.col}`;
}

function wrapInOpenedSection(lines: string[], header: string, createInternal: () => void) {
  lines.push('<details open>', summary(header), '');
  createInternal();
  lines.push('', '</details>', '');
}

function wrapInFileSection(lines: string[], file: string, createInternal: () => void) {
  lines.push(`<details>${summary(file)}<br>`);
  createInternal();
  lines.push('</details>', '');
}

function createCodeBlock(lines: string[], ext: string, code: string) {
  lines.push('```' + ext, code, '```');
}

function listForSuggestionClang(issues: Issues, type: ClangType): [[string, ClangIssueDetails[]][], number] {
  if (!issues[type]) return [null, 0];
  const fileIssuesList = Object.entries(issues[type]);
  const totalIssues = fileIssuesList.reduce((total, details) => total + details[1].length, 0);
  return totalIssues ? [fileIssuesList, totalIssues] : [null, 0];
}

function createCommentForClang(lines: string[], issues: Issues, type: ClangType, emoji: string, ranCmd: string) {
  const [typeIssues, totalIssues] = listForSuggestionClang(issues, type);
  const annotations: AnnotationProperties[] = [];

  if (totalIssues) {
    lines.push('', typeHeader(emoji, totalIssues, type, ranCmd));
    for (const [file, details] of typeIssues) {
      const ext = type === 'format' ? 'diff' : extname(file).substring(1);
      if (!details.length) continue;

      if (type === 'format') {
        annotations.push({
          command: 'error',
          file,
          startLine: 1,
          startColumn: 1,
          title: `Clang Format Issue`,
          message: 'Run the `clang-format` workflow on this branch to adhere this file to the style guide.',
        });
      }

      wrapInFileSection(lines, file, () => {
        for (const issue of details) {
          wrapInOpenedSection(lines, `<strong>${issueLocation(file, issue)}</strong>: ${issue.name}`, () => {
            lines.push(`> ${escape(issue.message)}`, '');
            if (issue.replacement) {
              createCodeBlock(lines, ext, issue.replacement);
            }
          });

          if (type === 'tidy') {
            annotations.push({
              command: issue.level,
              file,
              startLine: issue.line,
              startColumn: issue.col,
              title: `Clang Tidy ${toTitleCase(issue.level)}: ${issue.name}`,
              message: issue.message,
            });
          }
        }
      });
    }
  }

  return annotations;
}

function createCommentForSpelling(lines: string[], spellingIssues: SpellingTypeIssues) {
  if (!spellingIssues) return [];
  const annotations: AnnotationProperties[] = [];

  const totalIssues = Object.values(spellingIssues)
    .reduce((total, words) => total + Object.values(words)
      .reduce((subTotal, issues) => subTotal + issues.instances.length, 0), 0);

  if (totalIssues) {
    lines.push('', typeHeader('book', totalIssues, 'spelling', 'cspell'));
    for (const [file, words] of Object.entries(spellingIssues)) {
      const ext = extname(file).substring(1);
      wrapInFileSection(lines, file, () => {
        for (const {word, suggestions, instances} of Object.values(words)) {
          const title = `"${word}": Unknown word`;
          const message = `${suggestions.map(s => '`' + s + '`').join(', ')}`;
          wrapInOpenedSection(lines, `<strong>${title}</strong>`, () => {
            lines.push('> Possible replacements:', message, '', `"${word}" found at:`);

            for (const issue of instances) {
              wrapInOpenedSection(
                lines, `${issueLocation(file, issue)}`, () => createCodeBlock(lines, ext, issue.replacement));
              annotations.push({
                command: 'error',
                file,
                startLine: issue.line,
                startColumn: issue.col,
                title,
                message: `Possible replacements: ${message}`,
              });
            }
          });
        }
      });
    }
  }

  return annotations;
}

const REVIEW_TAG = '<!-- one-review-bot comment -->';

function createPullRequestComment(issues: Issues) {
  const lines = [REVIEW_TAG];

  const spellAnnotations = createCommentForSpelling(lines, issues.spelling);
  const tidyAnnotations = createCommentForClang(lines, issues, 'tidy', 'wrench', 'clang-tidy');
  const formatAnnotations = createCommentForClang(lines, issues, 'format', 'scroll', 'clang-format');

  const allAnnotations = {
    spellAnnotations,
    tidyAnnotations,
    formatAnnotations,
  };

  if (lines.length === 1) {
    lines.push(':robot: Passed All One Review Bot Checks :heavy_check_mark:');
  }
  else {
    lines.splice(1, 0, '# :robot: One Review Bot Results');
  }

  return {comment: lines.join('\n'), allAnnotations};
}

async function getExistingReviewComments(githubContext: ContextInstance, octokit: GitHubInstance, prNumber: number) {
  const comments = await octokit.rest.issues.listComments({
    ...githubContext.repo,
    issue_number: prNumber,
  });

  verbose('Found', pluralize('comment', comments.data.length), 'on this PR');
  comments.data.forEach(comment => verbose('\t' + comment.body.split('\n').slice(0, 3).join('\t\n')));
  return comments.data.filter(comment => comment.body.startsWith(REVIEW_TAG));
}

export async function postComments(issues: Issues, githubContext: ContextInstance, octokit: GitHubInstance) {
  const {comment, allAnnotations} = createPullRequestComment(issues);

  const prNumber = githubContext.payload.pull_request?.number;
  const pastComments = await getExistingReviewComments(githubContext, octokit, prNumber);
  info('Found', pluralize('past bot comment', pastComments.length));

  const lastBotComment = pastComments[pastComments.length - 1];
  const hasIdenticalComment = lastBotComment?.body === comment;
  if (hasIdenticalComment) {
    info('New comment same as last One Review Bot comment on PR#', prNumber.toString());
    info('See comment at', lastBotComment.url);
  }
  else {
    info('Posting comment to PR#', prNumber.toString());
    await octokit.rest.issues.createComment({
      ...githubContext.repo,
      issue_number: prNumber,
      body: comment,
    });
  }

  return allAnnotations;
}
