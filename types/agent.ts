import type { Entity, Activity, Attribution } from "@/types/provenance";

class ProvenanceTracker {
  private entities: Map<string, Entity> = new Map();
  private activities: Map<string, Activity> = new Map();
  private attributions: Map<string, Attribution[]> = new Map();

  addEntity(entity: Entity): void {
    this.entities.set(entity.id, entity);
  }

  addActivity(activity: Activity): void {
    this.activities.set(activity.id, activity);

    // Auto-create attributions for outputs
    activity.outputs.forEach((outputId) => {
      const existingAttributions = this.attributions.get(outputId) || [];

      // Add creator attribution for the performer
      const creatorAttribution: Attribution = {
        resourceId: outputId,
        contributorId: activity.performedBy,
        role: "creator",
        weight: 0.8,
        includedInCredits: true,
      };

      existingAttributions.push(creatorAttribution);

      // Add source material attributions for inputs
      activity.inputs.forEach((inputId) => {
        const sourceAttribution: Attribution = {
          resourceId: outputId,
          contributorId: inputId,
          role: "sourceMaterial",
          weight: 0.2 / activity.inputs.length,
          includedInCredits: true,
        };
        existingAttributions.push(sourceAttribution);
      });

      this.attributions.set(outputId, existingAttributions);
    });
  }

  addAttribution(attribution: Attribution): void {
    const existing = this.attributions.get(attribution.resourceId) || [];
    existing.push(attribution);
    this.attributions.set(attribution.resourceId, existing);
  }

  getEntities(): Entity[] {
    return Array.from(this.entities.values());
  }

  getActivities(): Activity[] {
    return Array.from(this.activities.values());
  }

  getAttributions(): Attribution[] {
    return Array.from(this.attributions.values()).flat();
  }

  getEntityById(id: string): Entity | undefined {
    return this.entities.get(id);
  }

  getActivityById(id: string): Activity | undefined {
    return this.activities.get(id);
  }

  getAttributionsForResource(resourceId: string): Attribution[] {
    return this.attributions.get(resourceId) || [];
  }

  generateResourceId(type: string, name?: string): string {
    const timestamp = Date.now();
    const suffix = name ? `-${name.toLowerCase().replace(/\s+/g, "-")}` : "";
    return `${type}:${timestamp}${suffix}`;
  }

  generateActivityId(type: string): string {
    const timestamp = Date.now();
    return `activity:${type}-${timestamp}`;
  }

  clear(): void {
    this.entities.clear();
    this.activities.clear();
    this.attributions.clear();
  }
}

export const provenanceTracker = new ProvenanceTracker();
