use std::collections::{HashMap, HashSet};

use cost_library::{CostLibrary, CostReferenceItem};

use crate::route::cost::estimate::{
    CostEstimateOptionsInternal,
    cost_calculator::CostCalculator,
    request::{CostItemParameters, Parameters},
    response::{
        CostEstimateError, CostEstimateErrorMissingProperties, CostEstimateErrorUnknownCostItem,
        CostItemCosts, MissingProperty,
    },
};

pub type CostReferenceItems<'library> = HashMap<&'library str, &'library CostReferenceItem>;

#[derive(Debug)]
pub struct LinkedCostItem<'library, 'item> {
    pub id: &'item str,
    pub parameters: &'item Parameters,
    pub quantity: u32,
    pub cost_reference_item: &'library CostReferenceItem,
    pub cost_library: &'library CostLibrary,
}

impl<'library, 'item> LinkedCostItem<'library, 'item> {
    pub fn find_and_link(
        cost_item: &'item CostItemParameters,
        cost_reference_items: &'library CostReferenceItems<'library>,
        cost_library: &'library CostLibrary,
    ) -> Result<Self, CostEstimateError> {
        let cost_reference_item = cost_reference_items
            .get(cost_item.cost_item_ref.as_str())
            .ok_or_else(|| {
                CostEstimateError::UnknownCostItem(CostEstimateErrorUnknownCostItem {
                    id: cost_item.id.clone(),
                })
            })?;

        Self::link(
            &cost_item.id,
            &cost_item.parameters,
            cost_item.quantity,
            cost_reference_item,
            cost_library,
        )
    }

    fn link(
        id: &'item str,
        parameters: &'item Parameters,
        quantity: u32,
        cost_reference_item: &'library CostReferenceItem,
        cost_library: &'library CostLibrary,
    ) -> Result<Self, CostEstimateError> {
        let required_scaling_factor_parameters = cost_reference_item
            .scaling_factors
            .iter()
            .map(|factor| &factor.name);
        let required_variable_opex_contribution_parameters = cost_reference_item
            .variable_opex_contributions
            .iter()
            .map(|opex_contribution| &opex_contribution.name);

        let required_parameters: HashSet<&String> = required_scaling_factor_parameters
            .chain(required_variable_opex_contribution_parameters)
            .collect();
        let provided_parameters: HashSet<&String> = parameters.keys().collect();

        if required_parameters.is_subset(&provided_parameters) {
            Ok(LinkedCostItem {
                id,
                parameters,
                quantity,
                cost_reference_item,
                cost_library,
            })
        } else {
            let missing_parameters = required_parameters
                .difference(&provided_parameters)
                .copied();
            Err(CostEstimateError::MissingProperties(
                CostEstimateErrorMissingProperties {
                    properties: missing_parameters
                        .map(|property| MissingProperty {
                            id: id.to_string(),
                            property: property.clone(),
                        })
                        .collect(),
                },
            ))
        }
    }

    pub fn get_costs(
        &self,
        options: &CostEstimateOptionsInternal,
    ) -> Result<CostItemCosts, CostEstimateError> {
        let direct_equipment_cost = self
            .cost_library
            .calculate_direct_equipment_cost(self.cost_reference_item, self.parameters, options)?
            .map(|v| v * self.quantity as f64);
        let total_installed_cost = self
            .cost_library
            .calculate_total_installed_cost(self.cost_reference_item, self.parameters, options)?
            .map(|v| v * self.quantity as f64);

        let variable_opex_cost_per_year = self.cost_library.calculate_variable_opex_cost(
            self.cost_reference_item,
            self.parameters,
            options,
        )? * self.quantity as f64;

        Ok(CostItemCosts {
            direct_equipment_cost,
            total_installed_cost,
            variable_opex_cost_per_year,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn load_cost_library_v1_1() -> CostLibrary {
        crate::get_cost_library!("V1.1_working")
    }

    fn get_cost_reference_item_map<'library>(
        cost_library: &'library CostLibrary,
    ) -> CostReferenceItems<'library> {
        cost_library
            .modules
            .iter()
            .flat_map(|module| &module.cost_items)
            .map(|cost_item| (cost_item.id.as_ref(), cost_item))
            .collect()
    }

    #[test]
    fn test_find_and_link() {
        let cost_library = load_cost_library_v1_1();
        let cost_reference_items = get_cost_reference_item_map(&cost_library);
        let cost_item = CostItemParameters {
            id: "a1".to_string(),
            cost_item_ref: "Item 074".to_string(),
            quantity: 1,
            parameters: [
                ("Thermal Duty".to_string(), 100.0),
                ("Captured CO2".to_string(), 200.0),
                ("Electrical power".to_string(), 300.0),
            ]
            .into_iter()
            .collect(),
        };

        let linked_cost_item =
            LinkedCostItem::find_and_link(&cost_item, &cost_reference_items, &cost_library)
                .unwrap();
        assert_eq!(linked_cost_item.id, cost_item.id);
        assert_eq!(linked_cost_item.parameters, &cost_item.parameters);
        assert_eq!(linked_cost_item.quantity, cost_item.quantity);
        assert_eq!(
            &linked_cost_item.cost_reference_item,
            cost_reference_items.get("Item 074").unwrap()
        );
    }

    #[test]
    fn test_find_and_link_missing_parameters() {
        let cost_library = load_cost_library_v1_1();
        let cost_reference_items = get_cost_reference_item_map(&cost_library);
        let cost_item = CostItemParameters {
            id: "a1".to_string(),
            cost_item_ref: "Item 074".to_string(),
            quantity: 1,
            parameters: [("Captured CO2".to_string(), 200.0)].into_iter().collect(),
        };

        let error = LinkedCostItem::find_and_link(&cost_item, &cost_reference_items, &cost_library)
            .unwrap_err();

        // Because the list of missing properties is unsorted, we must sort it before comparing it.
        let CostEstimateError::MissingProperties(CostEstimateErrorMissingProperties {
            mut properties,
        }) = error
        else {
            panic!("Wrong error was emitted");
        };

        properties.sort_by_key(|property| property.property.clone());

        assert_eq!(
            properties,
            vec![
                MissingProperty {
                    id: "a1".to_string(),
                    property: "Electrical power".to_string()
                },
                MissingProperty {
                    id: "a1".to_string(),
                    property: "Thermal Duty".to_string()
                }
            ]
        )
    }

    #[test]
    fn test_find_and_link_unknown_cost_item() {
        let cost_library = load_cost_library_v1_1();
        let cost_reference_items = get_cost_reference_item_map(&cost_library);
        let cost_item = CostItemParameters {
            id: "a1".to_string(),
            cost_item_ref: "Item 999".to_string(),
            quantity: 1,
            parameters: [("Captured CO2".to_string(), 200.0)].into_iter().collect(),
        };

        let error = LinkedCostItem::find_and_link(&cost_item, &cost_reference_items, &cost_library)
            .unwrap_err();
        assert_eq!(
            error,
            CostEstimateError::UnknownCostItem(CostEstimateErrorUnknownCostItem {
                id: "a1".to_string()
            })
        )
    }
}
