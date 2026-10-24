import { IBaseEntityModel, UUID } from '@nexius/core';

import { CopyElementPayload, copyElement } from '../../../tree/nxc-data-tree-component/data-tree.actions';
import { deepCopy } from '../../../utils/utils';
import { IAssetFile } from '../../asset-file/asset-file.interface';
import { IAsset } from '../../asset/asset.interface';
import { IFieldStyleDescriptor } from '../../field-style-descriptor/field-style-descriptor.interface';
import { InteractionActionTypes, InteractionService } from '../../interaction';
import { IInteraction } from '../../interaction/interaction.interface';
import { LearningContentFieldType } from '../learning-content-field-type.enum';
import { ILearningContentField } from '../learning-content-field.interface';
import {
  ICopiedElementPayload, ICopiedFieldStyleDescriptor, ICopiedInteraction, ICopiedLearningContentField, ICopyActionPayload,
} from './learning-content-field-util.interface';

/**
* Development documentation place
*
* {@link https://docs.google.com/document/d/1mHmI5Sl1XpRQE5wkLY4eU6At8-jSDoTTVRFhzPV2lh8/edit?usp=sharing System Documentation Overview}
* and {@link https://docs.google.com/document/d/12xmaDf-Rcegk3BrxyHHEFubQaXP9EtnR_m7eLX3crlc/edit#heading=h.t3tkg0surcad Copy process description}
*
**/
export class CopyFieldUtilityService {
    private isExistingTestFieldOnPage = false;
    private copyableActionTypesByTargetAction: InteractionActionTypes[] = [
        InteractionActionTypes.FILE_DOWNLOAD,
        InteractionActionTypes.ONE_PAGE_BACK_IN_HISTORY,
        InteractionActionTypes.CHANGE_PAGE_VARIABLE,
        InteractionActionTypes.EXTERNAL_LINK,
        InteractionActionTypes.PAGE_NAVIGATION,
    ];

    private readonly filterTestFieldsIfExistingTestFieldOnPage = (entity: ILearningContentField): boolean => {
        if (this.isExistingTestFieldOnPage) {
            return entity.type !== LearningContentFieldType.TEST_FIELD;
        } else {
            return true;
        }
    };

    private readonly isInteractionCopyableByTargetAction = (interaction: IInteraction): boolean =>
        this.copyableActionTypesByTargetAction.some((actionType) => actionType === interaction.targetAction);

    constructor(
        protected interactionService: InteractionService,
    ) { }

    public copy(
        action: { payload: CopyElementPayload },
        learningContentFieldList: ILearningContentField[],
        styleObjects: IFieldStyleDescriptor[],
        interactions: IInteraction[],
        assets: IAsset[],
        assetFiles: IAssetFile[]
    ): [
        ILearningContentField[],
        ILearningContentField[],
        IFieldStyleDescriptor[],
        IInteraction[],
        IAsset[],
        IAssetFile[]
    ] | [] {
        this.isExistingTestFieldOnPage = this.checkExistingTestFieldOnPage(learningContentFieldList);
        const actionPayload: ICopiedElementPayload = action?.payload;
        const copiedEntities = actionPayload?.copiedEntities;
        const isTestFieldCopyStoppable = this.isTestFieldCopyStoppable(learningContentFieldList, copiedEntities);

        if (isTestFieldCopyStoppable) {
            return [];
        }

        const markedCopiedFieldsInActionPayload = copiedEntities
            .filter(this.filterTestFieldsIfExistingTestFieldOnPage)
            .map(this.markFieldsAsCopied);

        const mergedFields = this.mergeUnique(
            [
                ...learningContentFieldList,
                ...markedCopiedFieldsInActionPayload
            ]
        );
        const newPageId = mergedFields[0].pageId;
        const mergedStyles = this.mergeUnique(
            [
                ...styleObjects,
                ...actionPayload.copiedStyleObjects.map(style => {
                    style.copied = true;
                    return style;
                })
            ]
        );
        const mergedInteractions = this.mergeUnique(
            [
                ...interactions,
                ...actionPayload.copiedInteractions.map(interaction => {
                    interaction.copied = true;
                    return interaction;
                })
            ]
        );
        const mergedAssets = this.mergeUnique(
            [...assets, ...actionPayload.copiedAssets]
        ).map(asset => { asset.pageId = newPageId; return asset; });
        const mergedAssetFiles = this.mergeUnique(
            [...assetFiles, ...actionPayload.copiedAssetFiles]
        );
        const originalField = this.getOriginalFieldByActionAndFields(mergedFields, action);
        const childList = this.getChildFields(originalField, mergedFields);
        const copiedFieldsAndStyles = this.copyFieldsStylesAndInteractions(
            action as ({ payload: CopyElementPayload & ICopyActionPayload }),
            originalField,
            childList,
            mergedFields,
            mergedStyles,
            mergedInteractions
        );

        return [...copiedFieldsAndStyles, mergedAssets, mergedAssetFiles];
    }

    setInteractionsTargetIds(
        relatedInteractions: IInteraction[],
        copiedFields: ICopiedLearningContentField[]
    ): IInteraction[] {
        const exceptedActions = [
            InteractionActionTypes.PAGE_NAVIGATION,
            InteractionActionTypes.FILE_DOWNLOAD
        ];

        const interactionsWithTargetIds = relatedInteractions.map(this.mapInteractionWithNewTargetIds(copiedFields, exceptedActions));
        return interactionsWithTargetIds;
    }

    private mapInteractionWithNewTargetIds(
        copiedFields: ICopiedLearningContentField[],
        exceptedActions: InteractionActionTypes[]
    ): (value: IInteraction, index: number, array: IInteraction[]) => IInteraction {
        return interaction => {
            const { targetIds, targetAction } = interaction;

            if (exceptedActions.includes(targetAction)) {
                return interaction;
            } else {
                const newTargetIds = copiedFields
                    .filter((field) => targetIds?.includes(field.oldId))
                    .map(field => field.id);
                return { ...interaction, targetIds: newTargetIds };
            }
        };
    }

    private isTestFieldCopyStoppable(learningContentFieldList: ILearningContentField[], copiedEntities: ILearningContentField[]) {
        const testFieldOnPage = learningContentFieldList.find((field) => field.type === LearningContentFieldType.TEST_FIELD);
        const isTestFieldCopyStoppable = copiedEntities.length === 1
            && copiedEntities[0].type === LearningContentFieldType.TEST_FIELD
            && typeof testFieldOnPage !== 'undefined';
        return isTestFieldCopyStoppable;
    }

    private checkExistingTestFieldOnPage(learningContentFieldList: ILearningContentField[]): boolean {
        return learningContentFieldList.some((field) => field.type === LearningContentFieldType.TEST_FIELD);
    }

    private mergeUnique<T extends { id: string }>(list: T[]): T[] {
        return list.filter((value, index, self) => {
            return self.findIndex(f => f.id === value.id) === index;
        });
    }

    private difference<T>(a: T[], b: T[]): T[] {
        const s = b.map(y => y['id']);
        return a.filter(x => !s.includes(x['id']));
    }

    private getOriginalFieldByActionAndFields(
        learningContentFieldList: ILearningContentField[],
        action: { payload: CopyElementPayload }
    ): ILearningContentField {
        const originalField = learningContentFieldList.find((field) => {
            return Boolean(action.payload.originalEntityId === field.id);
        });
        return Boolean(originalField) ? originalField : action.payload.newEntity as ILearningContentField;
    }

    private getChildFields(
        parentField: ILearningContentField | IBaseEntityModel,
        originalFields: ILearningContentField[]
    ): ILearningContentField[] {
        const fieldList: ILearningContentField[] = [];
        const seekFieldTree = (parentF: ILearningContentField | IBaseEntityModel, fields: ILearningContentField[], func: Function) => {
            let fieldChildTree = fields.filter((f: ILearningContentField) => {
                const isChild = parentF.id === f.parentId;
                if (isChild) {
                    fieldList.push(f);
                }
                return isChild;
            });
            const reducedListOfFields = this.difference<ILearningContentField>(fields, fieldChildTree);
            fieldChildTree = fieldChildTree.map((f: ILearningContentField) => {
                return func(f, reducedListOfFields, func);
            });
            return fieldChildTree;
        };
        seekFieldTree(parentField, originalFields, seekFieldTree);
        return fieldList;
    }

    private copyFieldsStylesAndInteractions(
        action: { payload: CopyElementPayload & ICopyActionPayload },
        originalParentField: ILearningContentField,
        childrenFields: ILearningContentField[],
        allFields: ILearningContentField[],
        styleDescriptors: IFieldStyleDescriptor[],
        interactions: IInteraction[]
    ): [
            ILearningContentField[],
            ILearningContentField[],
            IFieldStyleDescriptor[],
            IInteraction[]
        ] {
        const copiedFields: ILearningContentField[] = this.copyFields(childrenFields, originalParentField);
        const copiedFieldsWithNewProperties = this.fieldListPropertiesMapper(copiedFields, action);
        let copiedFieldsWithNewParentIds = this.setParentIdsOnFields(copiedFieldsWithNewProperties);
        const copiedStyleDescriptors = this.copyStyles(copiedFieldsWithNewParentIds, styleDescriptors);
        const copiedInteractions = this.copyInteractions(copiedFieldsWithNewParentIds, interactions);
        copiedFieldsWithNewParentIds = copiedFieldsWithNewParentIds.map(this.deleteOldProperties);
        const processedFields = this.removeCopiedFieldedItems([...allFields, ...copiedFieldsWithNewParentIds]);
        const [processedLearningContentFields, processedTestField] = this.separateTestAndNoneTestFields(processedFields);
        const processedStyleDescriptors = this.removeCopiedFieldedItems([...styleDescriptors, ...copiedStyleDescriptors]);
        let processedInteractions = this.removeCopiedFieldedItems([...interactions, ...copiedInteractions]);
        processedInteractions = this.interactionService.removeUnusedInteractions(processedFields, processedInteractions);

        return [
            [...processedLearningContentFields],
            [...processedTestField],
            [...processedStyleDescriptors],
            [...processedInteractions]
        ];
    }

    private separateTestAndNoneTestFields(
        processedFields: ILearningContentField[],
    ): [ILearningContentField[], ILearningContentField[]] {
        let processedLearningContentFields: ILearningContentField[] = [];
        let processedTestField: ILearningContentField[] = [];

        if (this.isExistingTestFieldOnPage) {
            processedLearningContentFields = processedFields;
            processedTestField = [];
        } else {
            processedLearningContentFields = this.filterNoneTestFields(processedFields);
            processedTestField = this.filterTestFields(processedFields);
        }

        return [processedLearningContentFields, processedTestField];
    }

    private filterNoneTestFields(processedFields: ILearningContentField[]): Array<ILearningContentField> {
        return processedFields.filter((field) => {
            return field.type !== LearningContentFieldType.TEST_FIELD;
        });
    }

    private filterTestFields(processedFields: ILearningContentField[]): Array<ILearningContentField> {
        return processedFields.filter((field) => {
            return field.type === LearningContentFieldType.TEST_FIELD;
        });
    }

    private markFieldsAsCopied(field: ICopiedLearningContentField): ICopiedLearningContentField {
        field.copied = true;
        return field;
    }

    private removeCopiedFieldedItems<T extends ICopiedLearningContentField | ICopiedFieldStyleDescriptor | ICopiedInteraction>(
        items: T[]
    ): T[] {
        let filteredItems: T[] = [];
        filteredItems = items.filter((item) => {
            return !Boolean(item?.copied);
        });
        return filteredItems;
    }

    private fieldListPropertiesMapper(
        list: ILearningContentField[],
        action: { payload: CopyElementPayload & ICopyActionPayload }
    ): ILearningContentField[] {
        return list.map((f: ILearningContentField, i: number): ILearningContentField => {
            const copiedField: ICopiedLearningContentField = deepCopy(f);
            delete copiedField.copied;
            const actionPayload = action?.payload;
            copiedField.title = copiedField.title;

            if (i === 0) {
                copiedField._order = actionPayload.newEntity._order;
                copiedField.oldId = f.id;
                copiedField.oldParentId = f.parentId;
                copiedField.pageId = actionPayload.targetEntity.pageId;
                copiedField.id = actionPayload.newEntity.id;
                copiedField.parentId = actionPayload.newEntity.parentId;
            } else {
                copiedField.oldId = copiedField.id;
                copiedField.oldParentId = copiedField.parentId;
                copiedField.id = UUID();
                copiedField.parentId = UUID();
                copiedField.pageId = actionPayload.targetEntity.pageId;
            }
            return copiedField;
        });
    }

    private deleteOldProperties(field: ICopiedLearningContentField) {
        if (field) {
            delete field.oldId;
            delete field.oldParentId;
        }
        return field;
    }

    private copyInteractions(copiedFields: ICopiedLearningContentField[], interactions: IInteraction[]) {
        const isSourceField = (field: ICopiedLearningContentField, interaction: ICopiedInteraction) => field.oldId === interaction.sourceId;
        const isTargetField = (
            field: ICopiedLearningContentField,
            interaction: ICopiedInteraction
        ) => interaction.targetIds?.includes(field.oldId);
        const pageId = copiedFields?.[0].pageId;
        const interactionsWithCorrectPageId = this.setPageIdForInteractions(pageId, interactions);
        let relatedInteractions = this.copyRelatedInteractions(interactionsWithCorrectPageId, copiedFields, isSourceField, isTargetField);
        relatedInteractions = this.filterInteractionsBySourceAndTarget(relatedInteractions, copiedFields, isSourceField, isTargetField);
        relatedInteractions = this.setInteractionsSourceId(relatedInteractions, copiedFields, isSourceField);
        relatedInteractions = this.setInteractionsTargetIds(relatedInteractions, copiedFields);
        relatedInteractions = this.setInteractionsGroupId(relatedInteractions);
        return relatedInteractions;
    }

    private setPageIdForInteractions(pageId: string, interactions: IInteraction[]) {
        return interactions.map((interaction: IInteraction): IInteraction => {
            interaction.pageId = pageId;
            return interaction;
        });
    }

    private filterInteractionsBySourceAndTarget(
        relatedInteractions: IInteraction[],
        copiedFields: ICopiedLearningContentField[],
        isSourceField: (
            field: ICopiedLearningContentField,
            interaction: IInteraction
        ) => boolean, isTargetField: (field: ICopiedLearningContentField, interaction: IInteraction) => boolean
    ): IInteraction[] {
        relatedInteractions = this.filterInteractions(relatedInteractions, copiedFields, isSourceField);
        relatedInteractions = this.filterInteractions(
            relatedInteractions,
            copiedFields,
            isTargetField,
            this.isInteractionCopyableByTargetAction
        );
        return relatedInteractions;
    }

    private filterInteractions(
        relatedInteractions: IInteraction[],
        copiedFields: ICopiedLearningContentField[],
        fn: (field: ILearningContentField, interaction: IInteraction) => boolean,
        isInteractionCopyable?: (interaction: IInteraction) => boolean
    ): IInteraction[] {
        return relatedInteractions.filter((interaction: IInteraction) => {
            return copiedFields.find((field) => {
                return fn(field, interaction) || isInteractionCopyable?.(interaction);
            });
        });
    }

    private copyRelatedInteractions(
        interactions: ICopiedInteraction[],
        copiedFields: ICopiedLearningContentField[],
        isSourceField: (field: ICopiedLearningContentField, interaction: IInteraction) => boolean,
        isTargetField: (field: ICopiedLearningContentField, interaction: IInteraction) => boolean
    ): IInteraction[] {
        const setNewIds = (interaction: ICopiedInteraction): IInteraction => {
            interaction.id = UUID();
            delete interaction.copied;
            return interaction;
        };

        let relatedInteractions = this.getRelatedInteractions(interactions, copiedFields, isSourceField, isTargetField);
        relatedInteractions = deepCopy(relatedInteractions);
        relatedInteractions = relatedInteractions.map(setNewIds);
        return relatedInteractions;
    }

    private getRelatedInteractions(
        interactions: IInteraction[],
        copiedFields: ILearningContentField[],
        isSourceField: (
            field: ILearningContentField,
            interaction: IInteraction
        ) => boolean, isTargetField: (field: ICopiedLearningContentField, interaction: IInteraction) => boolean
    ): IInteraction[] {
        return interactions.filter((interaction: IInteraction): boolean => {
            return copiedFields.some((field) => {
                return isSourceField(field, interaction) || isTargetField(field, interaction);
            });
        });
    }

    private setInteractionsSourceId(
        relatedInteractions: IInteraction[],
        copiedFields: ICopiedLearningContentField[],
        fn: (field: ICopiedLearningContentField, interaction: IInteraction) => boolean
    ): IInteraction[] {
        return relatedInteractions.map((interaction) => {
            const sourceField = copiedFields.find((field) => {
                return fn(field, interaction);
            });
            interaction.sourceId = sourceField ? sourceField.id : interaction.sourceId;
            return interaction;
        });
    }

    private setInteractionsGroupId(relatedInteractions: IInteraction[]): IInteraction[] {
        return relatedInteractions.map((interaction) => {
            interaction.groupId = null;
            return interaction;
        });
    }

    private copyFields(
        childrenFields: ILearningContentField[],
        originalParentField: ILearningContentField
    ): ILearningContentField[] {
        const originalFieldList = deepCopy(childrenFields);
        originalFieldList.unshift(deepCopy(originalParentField));
        return originalFieldList.filter(this.filterTestFieldsIfExistingTestFieldOnPage);
    }

    private copyStyles(fieldList: ICopiedLearningContentField[], styles: ICopiedFieldStyleDescriptor[]) {
        const copiedStyles: ICopiedFieldStyleDescriptor[] = [];

        fieldList.forEach((field) => {
            styles.forEach(style => {
                const isOwnStyle = style?.fieldId === (field?.oldId);
                if (isOwnStyle) {
                    const copiedStyle = deepCopy(style);
                    delete copiedStyle.copied;
                    copiedStyle.id = UUID();
                    copiedStyle.fieldId = field.id;
                    copiedStyles.push(copiedStyle);
                }
            });
        });

        return copiedStyles;
    }

    private setParentIdsOnFields(idList: Array<ICopiedLearningContentField>) {
        if (!idList.length) {
            return [];
        }
        let parentIdList = [idList[0]];
        const unique = (item, pos) => {
            return parentIdList.indexOf(item) === pos;
        };
        idList.forEach(idField => {
            const isParent = (field: ICopiedLearningContentField) => {
                return idField.oldId === field.oldParentId;
            };
            const setParentId = (field: ILearningContentField) => {
                field.parentId = idField.id;
                return field;
            };
            parentIdList = [
                ...parentIdList,
                ...idList
                    .filter(isParent)
                    .map(setParentId)
            ];
        });
        return parentIdList.filter(unique);
    }
}
