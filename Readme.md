# BuildControl PWA

BuildControl is a mobile-first Progressive Web App for construction material cost control, now with online login and cloud sync.

## Features

- Email and password account creation
- Login/logout with Firebase Authentication
- Online data sync with Cloud Firestore
- Add, edit, and delete construction materials
- Add, edit, and delete monthly saved money
- Automatic material status:
  - Pending
  - Partial
  - Completed
- Summary cards
- Chart.js dashboard
- Local backup for the last synced data
- PWA installation support
- Offline cache with Service Worker

## Files

- `index.html`
- `style.css`
- `script.js`
- `supabase-config.js`
- `manifest.json`
- `sw.js`
- `imagens/icon-192.png`
- `imagens/icon-512.png`

## Firebase setup

1. Create a Firebase project.
2. Add a Web app in Firebase Project Settings.
3. Copy the Firebase config object.
4. Paste the values into `supabase-config.js`.
5. In Firebase Authentication, enable **Email/Password**.
6. In Cloud Firestore, create a database.
7. Publish these Firestore security rules:

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /usuarios/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;

      match /buildcontrol/{document=**} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

## How to publish on GitHub Pages

Upload all files to the repository root and keep the same names:

- `index.html`
- `style.css`
- `script.js`
- `supabase-config.js`
- `manifest.json`
- `sw.js`
- `imagens/`

Then open the GitHub Pages URL in Chrome or Safari and install the PWA.


## Correção dos botões

O `script.js` foi corrigido para usar somente Supabase. A versão anterior estava com trecho antigo de Firebase no final do arquivo, o que quebrava o JavaScript e impedia os botões de adicionar materiais e valores.

Enquanto `supabase-config.js` não for preenchido, o app abre em modo local para os botões funcionarem durante os testes. Depois de preencher as credenciais do Supabase, o app exige login e salva online.
