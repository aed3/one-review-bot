# One Review Bot

A Github Action to post PR comments based on tools with which I like to review C++ code. That includes [cspell](https://github.com/streetsidesoftware/cspell/tree/main/packages/cspell) for checking spelling, [clang-format](https://clang.llvm.org/docs/ClangFormat.html) for ensuring the code's style is consistent across files, and [clang-tidy](https://clang.llvm.org/extra/clang-tidy/) for finding common errors. This repo is based on [streetsidesoftware/cspell-action](https://github.com/streetsidesoftware/cspell-action) for cspell integration and [cpp-linter/cpp-linter](https://github.com/cpp-linter/cpp-linter) for clang integration. I'm not glued to these checks as what I run my code against, so the supported tools here may change.

## Usage
Example `sample-action.yml`

```yml
name: One Review Bot

on:
  pull_request:

jobs:
  one-review-bot:
    name: ORB
    runs-on: ubuntu-latest
    steps:
      - name: Check out Git repository
        uses: actions/checkout@v3

      # The next two steps are to generate the compile_commands.json used by clang-tidy.
      # This is required for C++ project with more than a few files
      - name: Install Bear
        run: sudo apt install bear
      - name: Create compile_commands.json
      - run: bear -- make release

      # I'd recommend caching the result of this call as these can require large files
      # See https://github.com/KyleMayes/install-llvm-action#example-usage-with-caching
      - name: Install clang-tidy and clang-format
        uses: KyleMayes/install-llvm-action@v1.6.1
        with:
          version: "14.0.0"

      - name: Run One Review Bot
        uses: aed3/one-review-bot@v1
        with:
          # None of the parameters except github_token are required
          # They are listed here with their defaults

          github_token: ${{ github.token }}

          # Limit the files checked to the ones in the pull request.
          incremental_files_only: true

          # Path to file that defines glob patterns to filter the files to be included. Use a new line between patterns to define multiple patterns.
          # The default is to check ALL files that were changed in in the pull_request.
          # Note: `ignorePaths` defined in cspell.json still apply.
          # Example files:
          #   **/*.{cpp,hpp,h,c}
          #   !dist/**/*.{cpp,hpp,h,c}
          files_config: .bot-include

          # Path to `cspell.json` or equivalent file.
          # Default is none.
          # cspell_config:

          # Path to `.clang-tidy` or equivalent file.
          clang_tidy_config: .clang-tidy
  
          # Path to `.clang-format` or equivalent file.
          clang_format_config: .clang-format

          # The maximum number of lines to display when comparing the current code with the correctly-styled output from clang-format.
          max_diff_length: 20

          # The maximum number of times the same word can be flagged as an error in a file.
          max_duplicate_problems: 5

          # The point in the directory tree to start looking for files to check.
          root: .

          # Increase the log output.
          verbose: false
```
