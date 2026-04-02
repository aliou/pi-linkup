---
'@aliou/pi-linkup': patch
---

Remove prepare script to avoid dev deps being installed on git installs

The prepare script caused npm to install devDependencies when installing
from git, resulting in 350MB+ of unnecessary dependencies. Moved husky
setup to manual step in README development setup instructions.
