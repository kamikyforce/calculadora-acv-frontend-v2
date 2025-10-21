import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { CallbackComponent } from './components/callback/callback.component';
import { CalculosRegistradosComponent } from './components/calculos-registrados/calculos-registrados.component';
import { FuncoesAdministrativasComponent } from './components/funcoes-administrativas/funcoes-administrativas.component';
import { CertificadorasComponent } from './components/certificadoras/certificadoras.component';
import { IndustriasComponent } from './components/industrias/industrias.component';
import { AdministradoresComponent } from './components/administradores/administradores.component';
import { EnergiaECombustiveisComponent } from './components/energia-e-combustiveis/energia-e-combustiveis.component';
import { RebanhoComponent } from './components/rebanho/rebanho.component';
import { MutComponent } from './components/mut/mut.component';
import { AuthGuard } from './core/guards/auth.guard';
import { BancoDeFatoresComponent } from './components/banco-de-fatores/banco-de-fatores.component';
import { RoleGuard } from './guards/role.guard';
import { ProducaoAgricolaComponent } from './components/producao-agricola/producao-agricola.component';
import { JornadaPecuaristaComponent } from './components/jornada-pecuarista/jornada-pecuarista.component';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'callback', component: CallbackComponent },
  { 
    path: 'funcoes-administrativas', 
    component: FuncoesAdministrativasComponent,
    canActivate: [AuthGuard]
  },
  { 
    path: 'calculos-registrados', 
    component: CalculosRegistradosComponent,
    canActivate: [AuthGuard]
  },
  { 
    path: 'certificadoras', 
    component: CertificadorasComponent,
    canActivate: [AuthGuard]
  },
  { 
    path: 'industrias', 
    component: IndustriasComponent,
    canActivate: [AuthGuard]
  },
  { 
    path: 'administradores', 
    component: AdministradoresComponent,
    canActivate: [AuthGuard]
  },
  { 
    path: 'energia-e-combustiveis', 
    component: EnergiaECombustiveisComponent,
    canActivate: [AuthGuard]
  },
  { 
    path: 'banco-de-fatores', 
    component: BancoDeFatoresComponent,
    canActivate: [AuthGuard]
  },
  { 
    path: 'rebanho', 
    component: RebanhoComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'producao-agricola', 
    component: ProducaoAgricolaComponent,
    canActivate: [AuthGuard]
  },
  { 
    path: 'jornada-pecuarista', 
    component: JornadaPecuaristaComponent,
    canActivate: [AuthGuard]
  },
  { 
    path: 'jornada-pecuarista/:id', 
    component: JornadaPecuaristaComponent,
    canActivate: [AuthGuard]
  },
  { 
    path: 'mut', 
    component: MutComponent,
    canActivate: [RoleGuard]
  },
  { path: '**', redirectTo: '/login' }
];
