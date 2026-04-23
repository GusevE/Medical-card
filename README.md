# Medical-card

Небольшое приложение “Медицинская карточка” (Vite + React + Express + SQLite).

## Запуск в разработке

### 1) Сервер (API)

```bash
cd server
npm install
npm run dev
```

По умолчанию API на `http://localhost:5174`.

### 2) Клиент

```bash
cd ..
npm install
npm run dev
```

Клиент: `http://localhost:5173`.

## Доступы

- Admin: `admin` / `Tiguan2013!`
- User (только просмотр): `user` / `Arina2016`

## Бесплатный деплой (рекомендуемый)

### Frontend: GitHub Pages

1) Репозиторий → **Settings → Pages** → Source: **GitHub Actions**
2) Репозиторий → **Settings → Secrets and variables → Actions → Variables**
   - добавить переменную **`VITE_API_URL`** со значением URL вашего API (см. ниже)
3) После пуша в `main` страница будет доступна на GitHub Pages.

Если backend недоступен/не размещаете сервер — можно поставить:
- `VITE_API_URL = local`
Тогда приложение будет работать полностью автономно и сохранять данные в браузере (localStorage).

### Backend: Render (free)

1) Зайти на Render → New → **Blueprint** → выбрать репозиторий
2) Применить `render.yaml`
3) В настройках сервиса:
   - **`CLIENT_ORIGIN`**: URL GitHub Pages (например `https://guseve.github.io`)

Важно: на бесплатном тарифе Render сервис может “засыпать”, первый запрос после паузы будет дольше.

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
