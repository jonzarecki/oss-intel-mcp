# Demo recording for README GIF
# Run: vhs demo/record-gif.tape
# Output: demo/demo.gif

Output demo/demo.gif

Set Shell "bash"
Set FontSize 16
Set Width 1200
Set Height 750
Set Padding 15
Set TypingSpeed 20ms
Set Theme "Catppuccin Mocha"

# Launch quick replay (uses cached fixtures, no network needed)
Type "pnpm demo --quick"
Enter

# Act 0: Opening banner + prereq check
Sleep 5s

# Act 1: Should I Use This? — analyze express
Sleep 5s

# Act 1 cont: analysis output with verdict + metrics
Sleep 5s

# Act 2: Should I Contribute? — contributor experience
Sleep 5s

# Act 2 cont: PR health, retention, maintainers
Sleep 5s

# Act 3: Compare Repos — express vs fastify
Sleep 5s

# Act 3 cont: comparison table + recommendation
Sleep 5s

# Closing banner
Sleep 4s
