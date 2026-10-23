# front_tech_vite

Фронтенд для умного мониторинга и управления электросетевым хозяйством — дашборды, карта, журнал аудита и планы работ.

## Стек

| Слой | Технологии |
|------|-----------|
| Framework | React 19 + Vite 7 |
| UI-компоненты | Ant Design 5 |
| Маршрутизация | React Router 7 |
| Состояние | Zustand 5 |
| HTTP-клиент | Axios |
| Карты | OpenLayers, Leaflet + react-leaflet |
| Графики | @ant-design/charts |
| Анимации | Framer Motion, Anime.js |
| Данные/таблицы | xlsx (Excel-экспорт) |
| Утилиты | Day.js |

## Установка

```bash
npm install
```

## Запуск

```bash
npm run dev      # dev-сервер (http://localhost:5173)
npm run build    # production-сборка → dist/
npm run preview  # превью production-сборки
npm run lint     # ESLint
```

## Структура проекта

```
src/
├── main.jsx                          # точка входа
├── App.jsx                           # роутинг
├── index.css                         # глобальные стили
├── assets/                           # SVG-иконки, изображения
├── pages/                            # страницы (роуты)
│   ├── dashboard/                    # главное дашборд-страница
│   ├── operationalDashboard/         # оперативный дашборд (фильтры, карта, графики)
│   ├── pes/                          # ПЭС-модуль
│   ├── emergency/                    # аварийный модуль (ТН-таблица)
│   ├── planned/                      # плановые работы
│   ├── logging/                      # журнал аудита
│   └── loaderDemo/                   # демо-страница загрузчика
├── components/                       # переиспользуемые компоненты
│   ├── dashboard/                    # общие виджеты дашборда (карта, графики, блоки)
│   ├── operationalDashboard/         # секции оперативного дашборда (map, charts, donuts, districts)
│   ├── pes/                          # компоненты ПЭС-модуля
│   ├── emergency/                    # компоненты аварийного модуля
│   ├── planned/                      # таблица плановых работ
│   ├── logging/                      # панель журнала аудита
│   ├── Header / Footer               # шапка и подвал
│   ├── AuthForm                      # форма авторизации
│   ├── PostAuthSplash                # splash-экран после логина
│   └── Portal404                     # страница 404
└── tp.json                           # данные по ТП (временный файл)
```
