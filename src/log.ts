
import {ActionParams} from './actionParams';
import {AnnotationProperties as GHAnnotationProperties, core} from './github';

let isVerbose = false;

export function setVerbose(params: ActionParams) {
  isVerbose = params.verbose;
}

function coreLog(message: string[], level: 'debug'|'info'|'warning'|'error', props?: any) {
  const logger = core[level] as typeof core.error;
  logger(message.join(' '), props);
}

export function verbose(...message: string[]) {
  if (isVerbose) coreLog(message, 'info');
}

export function debug(...message: string[]) {
  if (core.isDebug()) coreLog(message, 'debug');
}

export function info(...message: string[]) {
  coreLog(message, 'info');
}

export type IssueLevel = 'warning'|'error';

export interface AnnotationProperties extends GHAnnotationProperties {
  command: IssueLevel;
  message: string;
}

export function makeAnnotations(annotations: AnnotationProperties[]) {
  for (const annotation of Object.values(annotations)) {
    coreLog([annotation.message], annotation.command, annotation);
  }
}
