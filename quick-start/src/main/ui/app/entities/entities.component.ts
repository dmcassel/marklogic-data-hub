import { Component, ViewChild, ViewContainerRef } from '@angular/core';

import { Entity } from '../entities/entity.model';
import { Flow } from '../entities/flow.model';

import { EntitiesService } from '../entities/entities.service';

import { MdlDialogService, MdlDialogReference, MdlSnackbarService } from '@angular-mdl/core';

import { MlcpUiComponent } from '../mlcp-ui';
import { HarmonizeFlowOptionsComponent } from '../harmonize-flow-options/harmonize-flow-options.component';
import { NewEntityComponent } from '../new-entity/new-entity';
import { NewFlowComponent } from '../new-flow/new-flow';

import { DeployService } from '../deploy/deploy.service';

import * as _ from 'lodash';

/* tslint:disable:max-line-length */
@Component({
  selector: 'app-has-bugs-dialog',
  template: `
  <h3 class="bug-title"><i class="fa fa-bug"></i>This flow has a bug!</h3>
  <p>You must fix it before you can run it.</p>
  <mdl-button mdl-button-type="raised" mdl-colored="primary" mdl-ripple (click)="dialog.hide()">OK</mdl-button>`,
  styleUrls: ['./entities.component.scss']
})
export class HasBugsDialogComponent {
  constructor(public dialog: MdlDialogReference) { }
}
/* tslint:enable:max-line-length */

@Component({
  selector: 'app-entities',
  templateUrl: './entities.component.html',
  styleUrls: ['./entities.component.scss'],
})
export class EntitiesComponent {
  @ViewChild(MlcpUiComponent) mlcp: MlcpUiComponent;
  @ViewChild(HarmonizeFlowOptionsComponent) harmonize: HarmonizeFlowOptionsComponent;

  entities: Array<Entity>;
  entity: Entity;
  flow: Flow;
  flowType: string;

  constructor(
    private entitiesService: EntitiesService,
    private deployService: DeployService,
    private snackbar: MdlSnackbarService,
    private dialogService: MdlDialogService
  ) {
    deployService.onDeploy.subscribe(() => {
      this.getEntities();
    });
    this.getEntities();
    this.deployService.validateUserModules();
  }

  getLastDeployed() {
    const lastDeployed = this.deployService.getLastDeployed();
    if (lastDeployed) {
      return lastDeployed.fromNow();
    }
    return 'Not Yet Deployed';
  }

  getErrors() {
    return this.deployService.errors;
  }

  hasErrors(): boolean {
    let errors = this.getErrors();
    return !!(errors && _.keys(errors).length > 0);
  }

  entityHasError(entityName: string): boolean {
    let errors = this.getErrors();
    return !!(errors && errors[entityName]);
  }

  flowHasError(entityName: string, flowName: string): boolean {
    let errors = this.getErrors();
    return !!(errors && errors[entityName] && errors[entityName][flowName]);
  }

  pluginHasError(flow: Flow, pluginType: string) {
    let errors = this.getErrors();
    return !!(
      errors &&
      errors[flow.entityName] &&
      errors[flow.entityName][flow.flowName] &&
      errors[flow.entityName][flow.flowName][pluginType]
    );
  }

  getErrorMessage(flow: Flow, pluginType: string) {
    let errors = this.getErrors();
    let o = errors[flow.entityName][flow.flowName][pluginType];
    return `ERROR:\n${o.msg}\n\nat\n\n${o.uri}:${o.line}:${o.column}`;
  }

  isCollapsed(entity: Entity): boolean {
    let collapsed: string = localStorage.getItem(entity.entityName + '-collapsed');
    if (collapsed === null) {
      collapsed = 'true';
    }
    return collapsed === 'true';
  }

  setCollapsed(entity: Entity, collapsed: boolean): void {
    localStorage.setItem(entity.entityName + '-collapsed', collapsed.toString());
  }

  getEntities(): void {
    this.entitiesService.getEntities().subscribe(entities => {
      this.entities = entities;
    });
  }

  toggleEntity(entity: Entity): void {
    const collapsed: boolean = this.isCollapsed(entity);
    _.each(this.entities, e => { this.setCollapsed(e, true); });
    this.setCollapsed(entity, !collapsed);
  }

  setFlow(ev: MouseEvent, entity: Entity, flow: Flow, flowType: string): void {
    if (this.mlcp.isVisible()) {
      this.mlcp.cancel();
    } else if (this.harmonize.isVisible()) {
      this.harmonize.cancel();
    }
    this.entity = entity;
    this.flow = flow;
    this.flowType = flowType;
    this.runFlow(ev, flow, flowType);
  }

  isActiveFlow(flow: Flow): boolean {
    return this.flow === flow;
  }

  isActiveEntity(entity: Entity): boolean {
    return this.entity === entity;
  }

  showNewEntity(ev: Event): void {
    let actions = {
      save: (newEntity: Entity) => {
      this.entitiesService.createEntity(newEntity).subscribe((entity: Entity) => {
        this.entities.splice(_.sortedIndexBy(this.entities, entity, 'entityName'), 0, entity);
        this.toggleEntity(entity);
      });
      }
    };
    this.dialogService.showCustomDialog({
      component: NewEntityComponent,
      providers: [
        { provide: 'actions', useValue: actions }
      ],
      isModal: true
    });
    // this.newEntity.show().subscribe((newEntity: Entity) => {
    //   this.entitiesService.createEntity(newEntity).subscribe((entity: Entity) => {
    //     this.entities.splice(_.sortedIndexBy(this.entities, entity, 'entityName'), 0, entity);
    //     this.toggleEntity(entity);
    //   });
    // });
  }

  newInputFlow(ev: Event, entity: Entity): void {
    this.showNewFlow(ev, entity, 'INPUT');
  }

  newHarmonizeFlow(ev: Event, entity: Entity): void {
    this.showNewFlow(ev, entity, 'HARMONIZE');
  }

  showNewFlow(ev: Event, entity: Entity, flowType: string): void {
    let actions = {
      save: (newFlow: Flow) => {
      this.entitiesService.createFlow(entity, flowType, newFlow).subscribe((flow: Flow) => {
        if (flowType === 'INPUT') {
          entity.inputFlows.push(flow);
        } else if (flowType === 'HARMONIZE') {
          entity.harmonizeFlows.push(flow);
        }
      });
      }
    };
    this.dialogService.showCustomDialog({
      component: NewFlowComponent,
      providers: [
        { provide: 'flowType', useValue: flowType },
        { provide: 'actions', useValue: actions }
      ],
      isModal: true
    });
  }

  runFlow(ev: MouseEvent, flow: Flow, flowType: string) {
    if (this.flowHasError(flow.entityName, flow.flowName)) {
      this.dialogService.showCustomDialog({
        component: HasBugsDialogComponent,
        providers: [],
        isModal: true
      });
    } else {
      const lower = flowType.toLowerCase();
      if (lower === 'input') {
        this.runInputFlow(ev, flow);
      } else if (lower === 'harmonize') {
        this.runHarmonizeFlow(ev, flow);
      }
    }
  }

  runInputFlow(ev: MouseEvent, flow: Flow): void {
    this.entitiesService.getInputFlowOptions(flow).subscribe(mlcpOptions => {
      this.mlcp.show(mlcpOptions, flow, ev).subscribe((options: any) => {
        this.entitiesService.runInputFlow(flow, options);
        this.snackbar.showSnackbar({
          message: flow.entityName + ': ' + flow.flowName + ' starting...',
        });
      });
    });
    ev.stopPropagation();
  }

  runHarmonizeFlow(ev: Event, flow: Flow): void {
    this.harmonize.show(flow).subscribe((options: any) => {
      this.entitiesService.runHarmonizeFlow(flow, options.batchSize, options.threadCount);
      this.snackbar.showSnackbar({
        message: flow.entityName + ': ' + flow.flowName + ' starting...',
      });
      ev.stopPropagation();
    });
  }

  redeployModules() {
    this.deployService.redeployUserModules().subscribe(() => {});
    this.snackbar.showSnackbar({
      message: 'Redeploying Modules...',
    });
  }
}
