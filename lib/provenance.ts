import type { Entity, Activity, Attribution } from "@/types/provenance";
import { provenanceStorage } from "@/lib/storage";

class ProvenanceTracker {
  addEntity(entity: Entity): void {
    provenanceStorage.addEntity(entity);
  }

  addActivity(activity: Activity): void {
    provenanceStorage.addActivity(activity);

    // Auto-create attributions for outputs
    activity.outputs.forEach((outputId) => {
      const existingAttributions =
        provenanceStorage.getAttributionsForResource(outputId);

      // Add creator attribution for the performer
      const creatorAttribution: Attribution = {
        resourceId: outputId,
        contributorId: activity.performedBy,
        role: "creator",
        weight: 0.8,
        includedInCredits: true,
      };

      provenanceStorage.addAttribution(creatorAttribution);

      // Add source material attributions for inputs
      activity.inputs.forEach((inputId) => {
        const sourceAttribution: Attribution = {
          resourceId: outputId,
          contributorId: inputId,
          role: "sourceMaterial",
          weight: 0.2 / activity.inputs.length,
          includedInCredits: true,
        };
        provenanceStorage.addAttribution(sourceAttribution);
      });
    });
  }

  addAttribution(attribution: Attribution): void {
    provenanceStorage.addAttribution(attribution);
  }

  getEntities(): Entity[] {
    return provenanceStorage.getEntities();
  }

  getActivities(): Activity[] {
    return provenanceStorage.getActivities();
  }

  getAttributions(): Attribution[] {
    return provenanceStorage.getAttributions();
  }

  getEntityById(id: string): Entity | undefined {
    return provenanceStorage.getEntityById(id);
  }

  getActivityById(id: string): Activity | undefined {
    return provenanceStorage.getActivityById(id);
  }

  getAttributionsForResource(resourceId: string): Attribution[] {
    return provenanceStorage.getAttributionsForResource(resourceId);
  }

  generateResourceId(type: string, name?: string): string {
    return provenanceStorage.generateResourceId(type, name);
  }

  generateActivityId(type: string): string {
    return provenanceStorage.generateActivityId(type);
  }
}

export const provenanceTracker = new ProvenanceTracker();
