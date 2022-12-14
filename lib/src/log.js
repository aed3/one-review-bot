"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeAnnotations = exports.info = exports.debug = exports.verbose = exports.setVerbose = void 0;
const github_1 = require("./github");
let isVerbose = false;
function setVerbose(params) {
    isVerbose = params.verbose;
}
exports.setVerbose = setVerbose;
function coreLog(message, level, props) {
    const logger = github_1.core[level];
    logger(message.join(' '), props);
}
function verbose(...message) {
    if (isVerbose)
        coreLog(message, 'info');
}
exports.verbose = verbose;
function debug(...message) {
    if (github_1.core.isDebug())
        coreLog(message, 'debug');
}
exports.debug = debug;
function info(...message) {
    coreLog(message, 'info');
}
exports.info = info;
function makeAnnotations(annotations) {
    for (const annotation of Object.values(annotations)) {
        coreLog([annotation.message], annotation.command, annotation);
    }
}
exports.makeAnnotations = makeAnnotations;
//# sourceMappingURL=log.js.map