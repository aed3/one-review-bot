import {execSync} from 'child_process'

execSync('npm i', {cwd: __dirname});

import {getActionParams} from './actionParams';
import {action as clang} from './clang'
import {action as cspell} from './cspell'
import {gatherFiles} from './findFiles';
import {Context, core, getOctokit} from './github'
import {info, makeAnnotations, setVerbose, verbose} from './log';
import {pluralize, postComments} from './post';

export async function run(): Promise<void> {
  const initialCwd = process.cwd();
  try {
    info('🤖 One Review Bot');
    const githubContext = new Context();
    const params = getActionParams();
    const octokit = getOctokit(params.github_token);

    setVerbose(params);
    verbose('Parameters:', JSON.stringify(params, null, 2));

    process.chdir(params.root || '.');
    verbose('Changed directory from', initialCwd, 'to', process.cwd());

    const files = await gatherFiles(githubContext, octokit, params);
    info('Checking files:\n\t' + files.slice().sort().join('\n\t'));

    const issues = {};
    const spellIssues = await cspell(params, files);
    const clangIssues = clang(params, files);

    Object.assign(issues, spellIssues);
    Object.assign(issues, clangIssues);

    const allAnnotations = await postComments(issues, githubContext, octokit);
    const annotationsList = Object.values(allAnnotations).flat();
    const totalIssues = annotationsList.length;

    makeAnnotations(annotationsList);

    if (totalIssues) {
      info('Found', pluralize('cspell issue', allAnnotations.spellAnnotations.length));
      info('Found', pluralize('clang-format issue', allAnnotations.formatAnnotations.length));
      info('Found', pluralize('clang-tidy issue', allAnnotations.tidyAnnotations.length));
      core.setFailed(`Found ${pluralize('total issue', totalIssues)}`);
    }
    else {
      info('No Issues Found!');
    }

    info('Done.');
  }
  catch (error) {
    console.error(error);
    core.setFailed(error.message);
  }
}

run();
