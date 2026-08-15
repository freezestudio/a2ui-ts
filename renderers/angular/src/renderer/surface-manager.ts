import { signal, type Signal } from '@angular/core';
import { effect as preactEffect } from '@preact/signals-core';
import { SurfaceManager as CoreSurfaceManager, findRootComponent as coreFindRootComponent } from '@a2ui-ts/web-core';
import type { Surface, A2UIDescriptor } from '@a2ui-ts/web-core';

export type { Surface, A2UIDescriptor } from '@a2ui-ts/web-core';
export const findRootComponent = coreFindRootComponent;

export class SurfaceManager {
  private _core = new CoreSurfaceManager();
  private _angularSurfaces = signal<Map<string, Surface>>(new Map());

  constructor() {
    preactEffect(() => {
      this._angularSurfaces.set(this._core.surfaces.value);
    });
  }

  get surfaces(): Signal<Map<string, Surface>> {
    return this._angularSurfaces;
  }

  get core(): CoreSurfaceManager {
    return this._core;
  }

  handleCreateSurface(
    surfaceId: string,
    catalogId?: string,
    surfaceProperties?: Record<string, unknown>,
    sendDataModel?: boolean,
  ): boolean {
    return this._core.handleCreateSurface(surfaceId, catalogId, surfaceProperties, sendDataModel);
  }

  handleUpdateComponents(surfaceId: string, components: A2UIDescriptor[]): void {
    this._core.handleUpdateComponents(surfaceId, components);
  }

  handleUpdateDataModel(surfaceId: string, path?: string, value?: unknown): void {
    this._core.handleUpdateDataModel(surfaceId, path, value);
  }

  handleDeleteSurface(surfaceId: string): void {
    this._core.handleDeleteSurface(surfaceId);
  }

  clear(): void {
    this._core.clear();
  }

  snapshot(): Surface[] {
    return this._core.snapshot();
  }

  restore(surfaces: Surface[]): void {
    this._core.restore(surfaces);
  }

  getSendDataModelPayload(): Record<string, unknown> | undefined {
    return this._core.getSendDataModelPayload();
  }

  getComponentMap(surface: Surface): Map<string, A2UIDescriptor> {
    return this._core.getComponentMap(surface);
  }

  handleCallRendererFunction(
    call: {
      functionCallId: string;
      call: string;
      args?: Record<string, unknown>;
    },
    onResponse?: (response: {
      functionCallId: string;
      value?: unknown;
      error?: { code: string; message: string };
    }) => void,
  ): void {
    this._core.handleCallRendererFunction(call, onResponse);
  }
}
