import { createBrowserRouter } from "react-router";
import Root from "./Root";
import { TrainingManagement } from "./components/TrainingManagement";
import { DashboardAnalitico } from "./components/DashboardAnalitico";
import { AuthPage } from "./components/AuthPage";
import { AuthConfirmationPage } from "./components/AuthConfirmationPage";
import { ProfilePage } from "./components/ProfilePage";
import { AutocheckinPage } from "./components/AutocheckinPage";

export const router = createBrowserRouter([
  {
    path: "/autocheckin",
    Component: AutocheckinPage,
  },
  {
    path: "/auth",
    Component: AuthPage,
  },
  {
    path: "/auth/confirmacao",
    Component: AuthConfirmationPage,
  },
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: TrainingManagement },
      { path: "treinamentos", Component: TrainingManagement },
      { path: "perfil", Component: ProfilePage },
    ],
  },
]);