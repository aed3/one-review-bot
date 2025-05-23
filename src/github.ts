import * as gh_core from '@actions/core';
import {getOctokit as gh_getOctokit} from '@actions/github';
import {Context as gh_Context} from '@actions/github/lib/context';
import {GitHub as gh_GitHub} from '@actions/github/lib/utils';
import {Octokit as gh_Octokit} from '@octokit/core';
import {restEndpointMethods as gh_restEndpointMethods} from '@octokit/plugin-rest-endpoint-methods';

const DEBUGGING = !!process.env.DEBUG;

interface GithubProxy {
  core: typeof gh_core;
  getOctokit: typeof gh_getOctokit;
  Context: typeof gh_Context;
  GitHub: typeof gh_GitHub;
  Octokit: typeof gh_Octokit;
  restEndpointMethods: typeof gh_restEndpointMethods;
}

let EXPORT: GithubProxy;

if (DEBUGGING) {
  const db_core: any = {
    getInput(name: string, options?: gh_core.InputOptions) {
      const input = process.argv.findIndex((arg) => arg === '--' + name);
      if (input === -1) {
        if (options?.required) console.warn(name + ' is required');
        return '';
      }
      return process.argv[input + 1].trim();
    },
    info: gh_core.info,
    error: gh_core.error,
    warning: gh_core.warning,
    startGroup: gh_core.startGroup,
    endGroup: gh_core.endGroup,
    isDebug: () => DEBUGGING,
    setFailed: console.error,
  };

  const db_rest: any = {
    pulls: {
      async listCommits() {
        return {data: [{sha: '0000000000'}]};
      },
      async listReviewComments() {
        return {
          data: [{
            user: {type: 'Bot'},
            body: '<!-- one-review-bot comment -->',
            pull_request_url: 'https://github.com/user/repo/pull/1',
          }],
        };
      },
    },
    repos: {
      async getCommit() {
        return {
          data: {
            files: [{filename: 'test1.cpp'}, {filename: 'test1.hpp'}, {filename: 'test2.cpp'}, {filename: 'test2.hpp'}],
          }
        }
      },
    },
    issues: {
      async createComment(obj) {
        const {body, ...rest} = obj;
        console.log('issue.createComment', rest, 'body:\n', body);
      },
    },
  };

  class db_Context {
    constructor() {
    }
    payload = {pull_request: {number: 1}};
    repo = {owner: 'user', repo: 'repo'};
    issue = {owner: 'user', repo: 'repo', number: 1};
  };

  const db_getOctokit: any = () => ({rest: db_rest});
  const db_restEndpointMethods: any = () => ({rest: db_rest});

  EXPORT = {
    core: db_core,
    getOctokit: db_getOctokit,
    Context: db_Context as any,
    GitHub: gh_GitHub,
    Octokit: gh_Octokit,
    restEndpointMethods: db_restEndpointMethods,
  };
}
else {
  EXPORT = {
    core: gh_core,
    getOctokit: gh_getOctokit,
    Context: gh_Context,
    GitHub: gh_GitHub,
    Octokit: gh_Octokit,
    restEndpointMethods: gh_restEndpointMethods,
  };
}

type ContextInstance = InstanceType<typeof gh_Context>;
type GitHubInstance = InstanceType<typeof gh_GitHub>;
type AnnotationProperties = gh_core.AnnotationProperties;

const {
  core,
  getOctokit,
  Context,
  GitHub,
  Octokit,
  restEndpointMethods,
} = EXPORT;

export {
  core,
  getOctokit,
  Context,
  GitHub,
  Octokit,
  restEndpointMethods,
  ContextInstance,
  GitHubInstance,
  AnnotationProperties,
};
