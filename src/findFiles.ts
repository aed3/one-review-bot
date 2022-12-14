import {GlobMatcher} from 'cspell-glob';
import {readdirSync, readFileSync} from 'fs';
import {join} from 'path';

import {ActionParams} from './actionParams';
import {ContextInstance, GitHubInstance, restEndpointMethods} from './github';
import {info, verbose} from './log';

function isString(s: string|unknown) {
  return typeof s === 'string';
}

async function* fetchFilesForCommitsX(githubContext: ContextInstance, octokit: GitHubInstance, commitIds: string[]) {
  const {owner, repo} = githubContext.repo;
  const {rest} = restEndpointMethods(octokit);
  for (const ref of commitIds) {
    const commit = await rest.repos.getCommit({owner, repo, ref});
    const files = commit.data.files;
    if (!files) continue;
    for (const f of files) {
      if (f.filename) {
        yield f.filename;
      }
    }
  }
}

async function fetchFilesForCommits(githubContext: ContextInstance, octokit: GitHubInstance, commitIds: string[]) {
  const files: Set<string> = new Set();
  for await (const file of fetchFilesForCommitsX(githubContext, octokit, commitIds)) {
    files.add(file);
  }
  return files;
}

async function getPullRequestFiles(githubContext: ContextInstance, octokit: GitHubInstance) {
  const {owner, repo, number: pull_number} = githubContext.issue;
  const {rest} = restEndpointMethods(octokit);
  const commits = await rest.pulls.listCommits({owner, repo, pull_number});

  return fetchFilesForCommits(githubContext, octokit, commits.data.map((c) => c.sha).filter(isString));
}

function filterFiles(globPattern: string, files: string[]) {
  const matcher = new GlobMatcher(globPattern, {dot: true});
  const kept: string[] = [];
  const filtered: string[] = [];
  for (const file of files) {
    (matcher.match(file) ? kept : filtered).push(file);
  }

  verbose('Files filtered out:\n\t' + filtered.join('\n\t'));
  return kept;
}

function* walkDirSync(dir: string) {
  verbose('Searching', dir);
  const files = readdirSync(dir, {withFileTypes: true});
  for (const file of files) {
    if (file.isDirectory()) {
      yield* walkDirSync(join(dir, file.name));
    }
    else {
      yield join(dir, file.name);
    }
  }
}

export async function gatherFiles(githubContext: ContextInstance, octokit: GitHubInstance, params: ActionParams) {
  const files: string[] = [];
  const globPattern = params.files_config ? readFileSync(params.files_config, 'utf8') : '';
  verbose('globPattern:\n\t' + globPattern.replace(/\n/g, '\n\t'));

  if (params.incremental_files_only) {
    const prNumber = githubContext.payload.pull_request?.number;
    if (prNumber) {
      info('Running on files change in PR#', prNumber.toString());
      const eventFiles = await getPullRequestFiles(githubContext, octokit);
      files.push(...eventFiles);
    }
  }

  if (!files.length) {
    files.push(...walkDirSync('.'));
  }

  return filterFiles(globPattern, files);
}
