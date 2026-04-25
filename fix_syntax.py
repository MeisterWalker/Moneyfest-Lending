with open('src/pages/LoansPage.js', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Add <> before <style>
code = code.replace("      ) : (\n        \n        <style>", "      ) : (\n        <>\n        <style>")
if "      ) : (\n        <style>" in code:
    code = code.replace("      ) : (\n        <style>", "      ) : (\n        <>\n        <style>")


# 2. Append the closing braces if missing
if "\n  )\n}" not in code[-30:]:
    code += "\n        </>\n      )}\n    </div>\n  )\n}\n"

with open('src/pages/LoansPage.js', 'w', encoding='utf-8') as f:
    f.write(code)

print("Syntax fixed")
