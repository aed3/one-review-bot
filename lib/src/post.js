"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.postComments = exports.pluralize = void 0;
const path_1 = require("path");
const log_1 = require("./log");
function pluralize(word, num) {
    return `${num} ${word}${num === 1 ? '' : 's'}`;
}
exports.pluralize = pluralize;
function escape(str) {
    return str.replace(/</g, '\\<').replace(/>/g, '\\>');
}
function toTitleCase(str) {
    return str[0].toUpperCase() + str.substring(1);
}
function typeHeader(emoji, totalIssues, type, ranCmd) {
    return `## :${emoji}: Found ${pluralize(type + ' issue', totalIssues)} using \`${ranCmd}\``;
}
function summary(str) {
    return `<summary>${str}</summary>`;
}
function issueLocation(file, issue) {
    return `${file}:${issue.line}:${issue.col}`;
}
function wrapInOpenedSection(lines, header, createInternal) {
    lines.push('<details open>', summary(header), '');
    createInternal();
    lines.push('', '</details>', '');
}
function wrapInFileSection(lines, file, createInternal) {
    lines.push(`<details>${summary(file)}<br>`);
    createInternal();
    lines.push('</details>', '');
}
function createCodeBlock(lines, ext, code) {
    lines.push('```' + ext, code, '```');
}
function listForSuggestionClang(issues, type) {
    if (!issues[type])
        return [null, 0];
    const fileIssuesList = Object.entries(issues[type]);
    const totalIssues = fileIssuesList.reduce((total, details) => total + details[1].length, 0);
    return totalIssues ? [fileIssuesList, totalIssues] : [null, 0];
}
function createCommentForClang(lines, issues, type, emoji, ranCmd) {
    const [typeIssues, totalIssues] = listForSuggestionClang(issues, type);
    const annotations = [];
    if (totalIssues) {
        lines.push('', typeHeader(emoji, totalIssues, type, ranCmd));
        for (const [file, details] of typeIssues) {
            const ext = type === 'format' ? 'diff' : (0, path_1.extname)(file).substring(1);
            if (!details.length)
                continue;
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
function createCommentForSpelling(lines, spellingIssues) {
    if (!spellingIssues)
        return [];
    const annotations = [];
    const totalIssues = Object.values(spellingIssues)
        .reduce((total, words) => total + Object.values(words)
        .reduce((subTotal, issues) => subTotal + issues.instances.length, 0), 0);
    if (totalIssues) {
        lines.push('', typeHeader('book', totalIssues, 'spelling', 'cspell'));
        for (const [file, words] of Object.entries(spellingIssues)) {
            const ext = (0, path_1.extname)(file).substring(1);
            wrapInFileSection(lines, file, () => {
                for (const { word, suggestions, instances } of Object.values(words)) {
                    const title = `"${word}": Unknown word`;
                    const message = `${suggestions.map(s => '`' + s + '`').join(', ')}`;
                    wrapInOpenedSection(lines, `<strong>${title}</strong>`, () => {
                        lines.push('> Possible replacements:', message, '', `"${word}" found at:`);
                        for (const issue of instances) {
                            wrapInOpenedSection(lines, `${issueLocation(file, issue)}`, () => createCodeBlock(lines, ext, issue.replacement));
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
function createPullRequestComment(issues) {
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
    return { comment: lines.join('\n'), allAnnotations };
}
function getExistingReviewComments(githubContext, octokit, prNumber) {
    return __awaiter(this, void 0, void 0, function* () {
        const comments = yield octokit.rest.pulls.listReviewComments(Object.assign(Object.assign({}, githubContext.repo), { pull_number: prNumber }));
        (0, log_1.verbose)('Found', pluralize('comment', comments.data.length), 'on this PR');
        comments.data.forEach(comment => { var _a, _b; return (0, log_1.verbose)(comment.body.split('\n').slice(0, 3).join(), '\n\n', ((_b = (_a = comment.body_html) === null || _a === void 0 ? void 0 : _a.split('\n').slice(0, 3).join()) !== null && _b !== void 0 ? _b : '')); });
        return comments.data.filter(comment => comment.body.startsWith(REVIEW_TAG));
    });
}
function postComments(issues, githubContext, octokit) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const { comment, allAnnotations } = createPullRequestComment(issues);
        const prNumber = (_a = githubContext.payload.pull_request) === null || _a === void 0 ? void 0 : _a.number;
        const pastComments = yield getExistingReviewComments(githubContext, octokit, prNumber);
        (0, log_1.info)('Found', pluralize('past bot comment', pastComments.length));
        const lastBotComment = pastComments[pastComments.length - 1];
        const hasIdenticalComment = (lastBotComment === null || lastBotComment === void 0 ? void 0 : lastBotComment.body) === comment;
        if (hasIdenticalComment) {
            (0, log_1.info)('New comment same as last One Review Bot comment on PR#', prNumber.toString());
            (0, log_1.info)('See comment at', lastBotComment.url);
        }
        else {
            (0, log_1.info)('Posting comment to PR#', prNumber.toString());
            yield octokit.rest.issues.createComment(Object.assign(Object.assign({}, githubContext.repo), { issue_number: prNumber, body: comment }));
        }
        return allAnnotations;
    });
}
exports.postComments = postComments;
//# sourceMappingURL=post.js.map