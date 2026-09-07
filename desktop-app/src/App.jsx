import React, { useState, useEffect, useMemo } from "react";
import { BUILD_VERSION, BUILD_DATE } from "./build-info";

const SCOPE = [["1.1", "PRODUCTION: To Check and Verify the reported production as per the rep…", "Sec 1 Production/OBR", "M"], ["1.1.1", "Under Ground Coal Production: Checking of Shift-wise coal production a…", "Sec 1 Production/OBR", "M"], ["1.1.2. (a)", "Coal - Departmental Checking of Shift-wise coal production as per Form…", "Sec 1 Production/OBR", "M"], ["1.1.2. (b)", "Coal – Outsourced Checking of Shift-wise coal production as per Form 1…", "Sec 1 Production/OBR", "M"], ["1.1.2. (c)", "Overburden - Departmental Checking of Shift-wise Over Burden (OB) remo…", "Sec 1 Production/OBR", "M"], ["1.1.2.(d)", "Over Burden - Outsourced  Checking of Shift-wise Over Burden (OB) remo…", "Sec 1 Production/OBR", "M"], ["1.1.2.(e)", "Report on incidences of theft of coal if any.", "Sec 1 Production/OBR", "M"], ["1.1.3 (a)", "Raw coal received  Checking of Shift-wise coal received as per Form 1-…", "Sec 1 Production/OBR", "M"], ["1.1.3 (b)", "Production: Checking of Shift-wise coal processed in washery as per Fo…", "Sec 1 Production/OBR", "M"], ["1.1.4", "Capacity utilization of the washery and comment on the reasons for und…", "Sec 1 Production/OBR", "M"], ["1.1.5", "Percentage of yield and comparison of the same with the target and last…", "Sec 1 Production/OBR", "M"], ["1.1.6", "To check whether the procedure adopted for OBR accounting is uniform w…", "Sec 1 Production/OBR", "Q"], ["1.1.7", "Whether parameters for OBR accounting in SAP have been properly fed in…", "Sec 1 Production/OBR", "Q"], ["1.1.8", "OBR Accounting is to be checked and certified by the Internal auditors…", "Sec 1 Production/OBR", "Q"], ["1.1.9", "Report on any additional cost through an additional contract for segre…", "Sec 1 Production/OBR", "M"], ["2.1", "Report on actual off-take with the Annual Action Plan (AAP) target.", "Sec 2 Marketing & Sales", "M"], ["2.2", "Checking of records that the coal is dispatched after weighing on elec…", "Sec 2 Marketing & Sales", "M"], ["2.3", "Report on deduction due to grade slippage, deduction due to non-comput…", "Sec 2 Marketing & Sales", "M"], ["2.4", "Report on overloading/under-loading (quantity and amount) and Demurrag…", "Sec 2 Marketing & Sales", "M"], ["2.5", "Report on Maintenance of records for road sales –   Delivery Order wis…", "Sec 2 Marketing & Sales", "M"], ["2.6", "(a) Report on Performance of weighbridge and % of coal weighed.  (b) R…", "Sec 2 Marketing & Sales", "M"], ["2.7", "Report of unweighed wagons, if any with the name of the party and plac…", "Sec 2 Marketing & Sales", "M"], ["2.8", "Report on delay in raising invoices for credit sales on the following:…", "Sec 2 Marketing & Sales", "M"], ["2.9", "Checking of Monthly reconciliation between billed quantity and dispatc…", "Sec 2 Marketing & Sales", "M"], ["2.10", "Checking of disputed and undisputed dues of Sundry Debtors, age-wise a…", "Sec 2 Marketing & Sales", "M"], ["2.11", "Checking of records of BG and timely action taken for renewal and enca…", "Sec 2 Marketing & Sales", "M"], ["2.12", "Checking of Sale bills (test check) are raised as per the Delivery ord…", "Sec 2 Marketing & Sales", "M"], ["2.13", "Report on input tax credit availed correctly and fully against Input G…", "Sec 2 Marketing & Sales", "M"], ["2.14", "Report on incentive/bonus bills has been raised timely and correctly a…", "Sec 2 Marketing & Sales", "M"], ["2.15", "Report on forfeiture of EMD from e-auction parties with quantity and v…", "Sec 2 Marketing & Sales", "M"], ["2.16", "To report on Un-lifted quantity/ Short dispatch Quantity to Power Plan…", "Sec 2 Marketing & Sales", "M"], ["2.17", "To check whether debit/credit notes have been issued within 30 days of…", "Sec 2 Marketing & Sales", "M"], ["2.18", "No. of complaints and grievances received from customers and settled/a…", "Sec 2 Marketing & Sales", "M"], ["2.19", "Checking of Delivery Orders for coal are in accordance with Fuel Suppl…", "Sec 2 Marketing & Sales", "M"], ["2.20", "Check the records for the supply of coal through washery mode as per F…", "Sec 2 Marketing & Sales", "M"], ["2.21", "Checking of Quarterly reconciliation of balances in Subsidiary ledger …", "Sec 2 Marketing & Sales", "Q"], ["2.22", "Checking of the advance amount received from the customer with the bil…", "Sec 2 Marketing & Sales", "M"], ["2.23", "Checking of EMD amount received on e-auction of coal and adjusted agai…", "Sec 2 Marketing & Sales", "M"], ["2.24", "Report on Weighbridge calibration done by the statutory authority and …", "Sec 2 Marketing & Sales", "M"], ["2.25", "Checking of under-loading charges calculated as per the Railway guidel…", "Sec 2 Marketing & Sales", "M"], ["2.26", "Report on the under-loading cost and quantity and reason thereof, its …", "Sec 2 Marketing & Sales", "M"], ["2.27", "Railway Siding: Checking of Shift-wise coal received at Railway Siding…", "Sec 2 Marketing & Sales", "M"], ["2.28", "Whether regular follow-up is made for Third party sampling agency(s) i…", "Sec 2 Marketing & Sales", "M"], ["2.29", "Whether regular follow-up is made in case of results of referee sample…", "Sec 2 Marketing & Sales", "M"], ["2.30", "Levying of penalty by Coal Companies: Report on account of delay in ca…", "Sec 2 Marketing & Sales", "M"], ["2.31", "Whether entry of quality related data is made by Coal Companies in ERP…", "Sec 2 Marketing & Sales", "M"], ["2.32", "To check whether refund / adjustment of EMD of successful buyers is do…", "Sec 2 Marketing & Sales", "M"], ["2.33", "To check whether refund of Coal Value of Un-lifted Quantity is done wi…", "Sec 2 Marketing & Sales", "M"], ["2.34", "To check whether Performance Security & Financial Coverage BGs are ret…", "Sec 2 Marketing & Sales", "M"], ["2.35", "To check whether Joint Reconciliation Statements properly incorporate …", "Sec 2 Marketing & Sales", "M"], ["2.36", "To check whether records of reason-wise claims of consumers not accept…", "Sec 2 Marketing & Sales", "M"], ["2.37", "To check whether long-pending unsettled claims of Coal Companies again…", "Sec 2 Marketing & Sales", "M"], ["2.38", "To check whether Interest Bills are raised timely on delayed payment a…", "Sec 2 Marketing & Sales", "M"], ["2.39", "To check whether undisputed dues reported by Coal Companies in MIS rep…", "Sec 2 Marketing & Sales", "Q"], ["2.40", "To verify whether expenditure for lodging, boarding and transportation…", "Sec 2 Marketing & Sales", "M"], ["3.1", "To report on the verification and reconciliation of Colliery-wise/Proj…", "Sec 3 Quantitative Reconciliation", "Q"], ["4.1", "Analysis of OMS. Checking of overall OMS and comparison with previous …", "Sec 4 Productivity", "M"], ["5.1", "MANPOWER: Checking of actual deployment of manpower with the approved …", "Sec 5 Inputs/Machines", "M"], ["5.2", "MACHINES (HEMM, CHP, SDL, LHD, CM, Surface Miners, High Wall Equipment…", "Sec 5 Inputs/Machines", "M"], ["5.2.1", "Checking of Monthly Performance of the HEMM (in respect of CIL Norms) …", "Sec 5 Inputs/Machines", "M"], ["5.2.2", "Checking of HEMM and UG Machines under breakdown for more than three m…", "Sec 5 Inputs/Machines", "M"], ["5.2.3", "Report on HEMM and other Machines – Report on mismatch of Equipment in…", "Sec 5 Inputs/Machines", "M"], ["5.2.4", "Maintenance of Logbooks of HEMM and other Machines: Checking of logboo…", "Sec 5 Inputs/Machines", "M"], ["5.3", "Burnt Oil: Checking of section-wise burnt oil received and disposed of…", "Sec 5 Inputs/Machines", "M"], ["5.4", "Checking of actual Performance of the Equipment under maintenance cont…", "Sec 5 Inputs/Machines", "M"], ["5.5", "Workshop – checking of jobs assigned and completed within time schedul…", "Sec 5 Inputs/Machines", "M"], ["5.6", "Rehabilitation of Equipment: Report on the machines rehabilitated and …", "Sec 5 Inputs/Machines", "M"], ["6.1", "Checking of statutory records required as per rule, if not report ther…", "Sec 6 Explosives", "M"], ["6.2", "Checking of Actual powder factor separately for Coal and OB party wise…", "Sec 6 Explosives", "M"], ["6.3", "Checking of records for supply of Site mixed Emulsion (SME) explosives…", "Sec 6 Explosives", "M"], ["6.4", "Report on comparison of Powder factor and Detonator factor with norms,…", "Sec 6 Explosives", "M"], ["6.5", "Report on variance analysis of cost per CuM/Tonne of OB and coal respe…", "Sec 6 Explosives", "M"], ["6.6", "Checking of Reconciliation of records of Explosive and accessories wit…", "Sec 6 Explosives", "M"], ["6.7", "Checking of monthly allocation quantity with purchase order quantity m…", "Sec 6 Explosives", "M"], ["6.8", "Checking of various deduction as per R.C. and actual deductions made, …", "Sec 6 Explosives", "M"], ["7.1", "Checking of records for receipt, issue &stock of support material.", "Sec 7 Safety", "M"], ["7.2", "Checking of consumption of all underground support and safety material…", "Sec 7 Safety", "M"], ["7.3", "Comment on the adequacy of preparedness of mine/ projects.", "Sec 7 Safety", "M"], ["8.1", "Checking of internal control regarding receipt, issue & stock of POL.", "Sec 8 Oil & Lubricants", "M"], ["8.2", "Physical verification of quantity of diesel on test check basis in tan…", "Sec 8 Oil & Lubricants", "M"], ["8.3", "Consumption of diesel per CuM of composite production in Open Cast Pro…", "Sec 8 Oil & Lubricants", "M"], ["8.4", "Consumption of diesel per working hour of the machine and comparison w…", "Sec 8 Oil & Lubricants", "M"], ["8.5", "Report on the consumption of POL – volume and price variance.", "Sec 8 Oil & Lubricants", "M"], ["8.6", "Report on short supply of HSD and recovery thereof.", "Sec 8 Oil & Lubricants", "M"], ["8.7", "Checking of records of Dip stick measurement of diesel tank before rec…", "Sec 8 Oil & Lubricants", "M"], ["8.8", "To check all credit notes/discounts given by IOCL as per the agreement…", "Sec 8 Oil & Lubricants", "M"], ["8.9", "Report on the POL issued to hire patch party and recovery thereof on b…", "Sec 8 Oil & Lubricants", "M"], ["9.1", "Report on consumption of Power per unit of production and comparison w…", "Sec 9 Power", "M"], ["9.2", "Report on contract demand (CD) of power and actual contract demand uti…", "Sec 9 Power", "M"], ["9.3", "Report on penalty imposed due to: Delay in payment. Low Power Factor R…", "Sec 9 Power", "M"], ["9.4", "Report on variance analysis of power cost per CuM/tonne as compared to…", "Sec 9 Power", "M"], ["9.5", "Report on concessional tariff for domestic consumption is availed of, …", "Sec 9 Power", "M"], ["9.6", "Checking of records that separate Meters are installed for industrial …", "Sec 9 Power", "M"], ["9.7", "Report on Energy Audit and its compliance. Report on Power Factor and …", "Sec 9 Power", "M"], ["9.8", "Report on Electrical Equipment /machine strength with its annual power…", "Sec 9 Power", "M"], ["9.9", "Whether the implementation of observations (Recommendations Made in En…", "Sec 9 Power", "M"], ["9.10", "i. Report on initiation of installation of the Solar panel at the unit…", "Sec 9 Power", "M"], ["10.1", "The utilization of Fund: Checking of budgetary control for indenting, …", "Sec 10 Finance", "M"], ["10.2", "Checking of balances of subsidiary ledgers with the General ledger and…", "Sec 10 Finance", "M"], ["10.3", "To report on the age-wise break-up of all advances & receivables appea…", "Sec 10 Finance", "Q"], ["10.4", "Checking of bills as per Supply/Work Order/Agreement/Manual on test ch…", "Sec 10 Finance", "M"], ["10.5", "To report on overdue payments to MSME. To report whether payment is ma…", "Sec 10 Finance", "M"], ["10.6", "Exceptional reports and types of exceptional transactions need to be c…", "Sec 10 Finance", "M"], ["10.7", "Verification of Investment of Surplus Fund: Whether CIL Deposit / Inve…", "Sec 10 Finance", "Q"], ["10.8", "Checking of Bank draft/Bankers Cheque, received towards EMD and Securi…", "Sec 10 Finance", "M"], ["10.9", "(i)Bank Guarantee: Checking for- To check the procedure regarding acce…", "Sec 10 Finance", "M"], ["10.10", "Checking of payment vouchers on test check basis.", "Sec 10 Finance", "M"], ["10.11", "Gratuity claims amount received from LIC as per One Year Renewable Gro…", "Sec 10 Finance", "M"], ["10.12", "Checking of legal bills whether paid as per schedule of legal fee to t…", "Sec 10 Finance", "M"], ["10.13", "Age Analysis of Vendor & Customer Open Items. To check whether reconci…", "Sec 10 Finance", "M"], ["10.14", "Report on Trade Payables outstanding more than 3 months with reason pr…", "Sec 10 Finance", "M"], ["10.15", "To verify that supply orders /work orders are signed by the authorized…", "Sec 10 Finance", "M"], ["10.16", "To check that the amount of laptop/tab value (WDV) with perquisite tax…", "Sec 10 Finance", "M"], ["10.17", "Air Tickets: Whether booking in respect of Air tickets done on the bas…", "Sec 10 Finance", "M"], ["10.18", "Booking of Hotel Accommodation:  Whether booking of accommodation is d…", "Sec 10 Finance", "M"], ["10.19", "Vehicle: (a) Whether hiring of vehicle is done as per terms & Conditio…", "Sec 10 Finance", "M"], ["10.20", "Insurance Fitness and all other Vehicle related information is maintai…", "Sec 10 Finance", "M"], ["10.21", "Leased Properties: (a) To check that the lease rent is recovered as pe…", "Sec 10 Finance", "M"], ["10.22", "Comments on the genuineness of payables for old open items under diffe…", "Sec 10 Finance", "M"], ["10.23", "Auditor’s specific comments on completeness and accuracy of booking of…", "Sec 10 Finance", "M"], ["10.24", "School Grant: To check, whether the school are complying with all the …", "Sec 10 Finance", "M"], ["10.25", "SAP-related points: All parked items need to be checked and also enqui…", "Sec 10 Finance", "M"], ["11.1", "Registration: Whether additional places of business within a state are…", "Sec 11 GST", "M"], ["11.2", "Invoice verification: Whether invoice has all the prescribed particula…", "Sec 11 GST", "M"], ["11.3", "GST Return & Payment: Whether returns as applicable have been filed wi…", "Sec 11 GST", "M"], ["11.4", "Input Tax Credit: Whether input tax credit is taken based on eligible …", "Sec 11 GST", "M"], ["11.5", "TDS on GST: Whether TDS on GST deducted as per GST Law and timely paym…", "Sec 11 GST", "M"], ["11.6", "RCM: Whether Reverse Charge has been paid on all inward supplies notif…", "Sec 11 GST", "M"], ["11.7", "Misc: Whether   books   of accounts are maintained    at    each    pl…", "Sec 11 GST", "M"], ["12.1", "Checking of Purchase orders placed are as per Purchase Manual and comp…", "Sec 12 Purchases", "M"], ["12.2", "Report on Purchase order placed under various mode of purchase as per …", "Sec 12 Purchases", "M"], ["12.3", "To check that no attempt has been made to split the tenders, to keep t…", "Sec 12 Purchases", "M"], ["12.4", "Checking of non-availability certificate and consumption pattern of la…", "Sec 12 Purchases", "M"], ["12.5", "Report on delay in placement of supply orders from the date of approva…", "Sec 12 Purchases", "M"], ["12.6", "To check that the material is received, and GR has been processed in S…", "Sec 12 Purchases", "M"], ["12.7", "Report on maintenance of records such as Tender Register, TCR files, S…", "Sec 12 Purchases", "M"], ["12.8", "To check that the local purchases are made within the powers delegated…", "Sec 12 Purchases", "M"], ["12.9", "To check if any advance payment is made to suppliers is as per the NIT…", "Sec 12 Purchases", "M"], ["12.10", "Checking of Modules Orders placed for rehabilitation of equipment/HEMM…", "Sec 12 Purchases", "M"], ["12.11", "Checking of procurement of centralized items at Area/ Project/ HQ is d…", "Sec 12 Purchases", "M"], ["12.12", "Checking of deletion or insertion of terms and conditions in the stand…", "Sec 12 Purchases", "M"], ["12.13", "To check that the e-tenders are floated, and reverse auction has been …", "Sec 12 Purchases", "M"], ["12.14", "To check whether all entries have been made in SAP against orders plac…", "Sec 12 Purchases", "M"], ["13.1", "To check & verify proper maintenance of records such as Day Book, Stor…", "Sec 13 Stores", "M"], ["13.2", "Physical verification of certain items of stores at random and basis o…", "Sec 13 Stores", "M"], ["13.3", "Checking of claims lodged for receipt of short material and damaged ma…", "Sec 13 Stores", "M"], ["13.4", "a. Checking of non-moving and slow-moving store items and to check the…", "Sec 13 Stores", "M"], ["13.5", "Checking of records maintained for scrap & disposal thereof.", "Sec 13 Stores", "M"], ["13.6", "Checking of relevant records of Charge-off Stores & spares lying for a…", "Sec 13 Stores", "M"], ["13.7", "Checking of reconciliation of materials issued from the Main Stores ta…", "Sec 13 Stores", "M"], ["13.8", "Checking of reconciliation between Inventory Ledger generated through …", "Sec 13 Stores", "Q"], ["13.9", "To check that the obsolete and non-moving stores & spares have been id…", "Sec 13 Stores", "M"], ["13.10", "To certify the list of obsolete, non-moving stores & spares which are …", "Sec 13 Stores", "A"], ["13.11", "In case of any agreement of buy-back of stores, the Auditor has to cer…", "Sec 13 Stores", "M"], ["13.12", "Checking of errors in Inventory Ledger and report thereon.", "Sec 13 Stores", "M"], ["13.13", "Checking of inspection reports on test check basis of material and the…", "Sec 13 Stores", "M"], ["13.14", "Checking of records of used tyres, battery and other recoverable items…", "Sec 13 Stores", "M"], ["13.15", "Checking of records of warranty spare parts/ spare parts provided with…", "Sec 13 Stores", "M"], ["13.16", "To check that all material received in stores is having material code …", "Sec 13 Stores", "M"], ["13.17", "Checking of records of grounded/surveyed off vehicles that the De-regi…", "Sec 13 Stores", "M"], ["13.18", "Shortages of stores and spares reported by stock verifier must be repo…", "Sec 13 Stores", "M"], ["13.19", "To check whether system for goods transfer/goods issue for workshop/ g…", "Sec 13 Stores", "M"], ["14.1", "Coal Transport: To check that the CMC manual is complied with in final…", "Sec 14 Service Contracts", "M"], ["14.1.1", "Checking of route map of coal transportation, which is certified by IE…", "Sec 14 Service Contracts", "M"], ["14.1.2", "Checking of work order executed is as per the terms of contract and de…", "Sec 14 Service Contracts", "M"], ["14.1.3", "Checking of monthly target   quantity for transport and penalty for sh…", "Sec 14 Service Contracts", "M"], ["14.1.4", "Surprise checks are to be carried out during weighment of trucks/ tipp…", "Sec 14 Service Contracts", "M"], ["14.1.5", "Checking of monthly reconciliation of coal transported with Dispatches…", "Sec 14 Service Contracts", "M"], ["14.1.6", "To check the quantity re-handled and approval of competent authority.", "Sec 14 Service Contracts", "M"], ["14.1.7", "Checking of records maintained at weighbridge e.g. Gate Pass, Bill, MB…", "Sec 14 Service Contracts", "M"], ["14.1.8", "Checking of bills of transporters and it is as per the terms and condi…", "Sec 14 Service Contracts", "M"], ["14.1.9", "Checking of escalation/de-escalation is calculated correctly and the s…", "Sec 14 Service Contracts", "M"], ["14.1.10", "Checking of reconciliation of coal transported from quarry and coal re…", "Sec 14 Service Contracts", "M"], ["14.1.11", "Checking of records of coal transportation done by both departmental a…", "Sec 14 Service Contracts", "M"], ["14.1.12", "To check that the GPS (Global Positioning System) installed in all the…", "Sec 14 Service Contracts", "M"], ["14.2", "Sand Transport:", "Sec 14 Service Contracts", "M"], ["14.2.1", "To check that the CMC manual is complied with in finalizing relevant t…", "Sec 14 Service Contracts", "M"], ["14.2.2", "To check the total quantity transported is within the awarded quantity…", "Sec 14 Service Contracts", "M"], ["14.2.3", "Checking of reconciliation statement (reconciliation of receipt quanti…", "Sec 14 Service Contracts", "M"], ["14.2.4", "Checking of book stock with physical stock of sand and any difference …", "Sec 14 Service Contracts", "M"], ["14.2.5", "Checking of records of Sand stowing and also to check that the claim f…", "Sec 14 Service Contracts", "M"], ["14.2.6", "Checking of sand stowing ratio and comparison with norms and variance …", "Sec 14 Service Contracts", "M"], ["14.2.7", "Checking of Shortest route for sand transportation has been identified…", "Sec 14 Service Contracts", "M"], ["14.3", "The Hiring of HEMM for OB Removal:", "Sec 14 Service Contracts", "M"], ["14.3.1", "To check that the CMC manual is complied with in finalizing relevant t…", "Sec 14 Service Contracts", "M"], ["14.3.2", "To check that the estimate is supported with shortest lead certificate…", "Sec 14 Service Contracts", "M"], ["14.3.2a", "To check and report on contracts of time and quantity extension grante…", "Sec 14 Service Contracts", "M"], ["14.3.3", "Whether there is any splitting of contract in terms of quantity/time t…", "Sec 14 Service Contracts", "M"], ["14.3.4", "Whether Personnel Dept. certified regarding fulfilling requirement of …", "Sec 14 Service Contracts", "M"], ["14.3.5", "No. of contracts extended for time / quantity and whether such extensi…", "Sec 14 Service Contracts", "M"], ["14.3.6", "Whether payment of escalation/de-escalation has been properly calculat…", "Sec 14 Service Contracts", "M"], ["14.3.7", "Checking of initial and final measurement document of contractual OB r…", "Sec 14 Service Contracts", "M"], ["14.3.8", "Reconciliation with survey report and OBR reported.", "Sec 14 Service Contracts", "M"], ["14.3.9", "Whether Uniform practice has been followed for acceptance / rejection …", "Sec 14 Service Contracts", "M"], ["14.3.10", "OBR removed during the year with bill paid and reconciliation with phy…", "Sec 14 Service Contracts", "M"], ["14.3.11", "Checking of the closing advance stripping with Surveyor’s Report.", "Sec 14 Service Contracts", "M"], ["14.3.12", "Verification of OBR measurement and accounting. Verification of initia…", "Sec 14 Service Contracts", "M"], ["14.3.13", "Whether Hindrance Register is maintained and updated for every Coal, S…", "Sec 14 Service Contracts", "M"], ["14.4", "Other Contracts: To check that the CMC manual is complied with in fina…", "Sec 14 Service Contracts", "M"], ["15.1", "To check that the Civil Engineering Manual / Contract Management Manua…", "Sec 15 Civil Works", "M"], ["15.2", "To check that no attempt has been made to split the tenders to keep th…", "Sec 15 Civil Works", "M"], ["15.3", "To check that the works awarded have been completed within the schedul…", "Sec 15 Civil Works", "M"], ["15.4", "To check that there is no failure on part of the management, due to wh…", "Sec 15 Civil Works", "M"], ["15.5", "To check that for completed works, final bills have been prepared in t…", "Sec 15 Civil Works", "M"], ["15.6", "To check and report for abnormal variations in quantities as per estim…", "Sec 15 Civil Works", "M"], ["15.7", "To check that the advances, if any paid against contract are adjusted …", "Sec 15 Civil Works", "M"], ["15.8", "To check that the payments have been made as per the terms and conditi…", "Sec 15 Civil Works", "M"], ["15.9", "To check BG/Security has been refunded only after No dues and Performa…", "Sec 15 Civil Works", "M"], ["16.1", "Manpower:  Reconciliation of manpower on roll manpower paid as per Pay…", "Sec 16 Establishment", "M"], ["16.2", "Service Record Verifications Whether photographs of the employee have …", "Sec 16 Establishment", "M"], ["16.3", "Attendance (Integrated with SAP): To check that the Bio-Metric attenda…", "Sec 16 Establishment", "M"], ["16.4", "Leave Records (Form G and H): To check that the leave records are main…", "Sec 16 Establishment", "Q"], ["16.5", "Overtime and Rest Day workings records (Form I): To check whether the …", "Sec 16 Establishment", "M"], ["16.6", "Visit to Hometown (HT) and Bharat Bhraman (BB):  To check that the Hom…", "Sec 16 Establishment", "M"], ["16.7", "Salary & Wages Audit: To check that the provisions of NCWA in case of …", "Sec 16 Establishment", "Q"], ["16.8", "Advances to Employees: To check that the advances are adjusted and in …", "Sec 16 Establishment", "M"], ["16.9", "Other Payments: Checking of other expenditures like TA, Transfer TA, L…", "Sec 16 Establishment", "M"], ["16.10", "Outside Repairs: To check that major outside repair has been done afte…", "Sec 16 Establishment", "M"], ["16.11", "Statutory Payments & Returns: Verification of receipts/acknowledgement…", "Sec 16 Establishment", "M"], ["16.12", "Corporate Social Responsibilities Expenses (CSR):  To check the CSR bu…", "Sec 16 Establishment", "M"], ["16.13", "Mine Closure Plan Expenditure (MCP): To check the progressive mine clo…", "Sec 16 Establishment", "M"], ["17.1", "To check that A.M.C‘s exists to protect the hardware and software inst…", "Sec 17 System", "M"], ["17.2", "To check whether CCTV recordings are being kept safely for future use …", "Sec 17 System", "M"], ["18.1", "To check life of assets is as per the uniform life policy of CIL", "Sec 18 Fixed Assets", "A"], ["18.2", "Checking of Fixed Assets Register having all required details e.g. Qua…", "Sec 18 Fixed Assets", "A"], ["18.3", "To check that the Physical verification of fixed assets has been carri…", "Sec 18 Fixed Assets", "A"], ["18.4", "Verification of title deeds of Lands.  Whether tittle deeds of immovab…", "Sec 18 Fixed Assets", "A"], ["18.5", "To check the reconciliation of balance as per Fixed Assets Register an…", "Sec 18 Fixed Assets", "A"], ["19.1", "HOSPITAL /DISPENSARY To check the receipt of the medicines and issue i…", "Sec 19 Hospital", "M"], ["20.1", "CENTRAL / REGIONAL WORKSHOP To check the records of shop wise, for exp…", "Sec 20 Workshop", "M"], ["21.1", "Sales Billing & Realization: Checking of records of jobs undertaken by…", "Sec 21 CMPDIL", "A"], ["21.2", "Business Development Division: To examine the Tenders or quotations re…", "Sec 21 CMPDIL", "A"], ["21.3", "Drilling Camp: Maintenance of Vehicle logbook. Maintenance of drill ma…", "Sec 21 CMPDIL", "A"], ["21.4", "Machine Utilization of Drilling Camps: To check the actual machine uti…", "Sec 21 CMPDIL", "A"], ["21.5", "Costing:  To check the cost arrived at for calculation of rate per met…", "Sec 21 CMPDIL", "A"]];
const THEMATIC = [["1.", "Manpower — Surplus/shortage. Manpower planning and recruitment."], ["2.", "Store & Scrap — Disposal record inventory (+) or (-) Non-availability of computers / Carde…"], ["3.", "HEMM / Machine Maintenance — Mismatch in equipment AMC doing their job or not Workshops do…"], ["4.", "SAP — Proper Implementation"], ["5.", "Statutory reports /returns — Being sent regularly or not"], ["6.", "Establishment / Advance — Monthly reconciliation of man shift as per attendance sheet and …"], ["7.", "Environment & Forest — Status of obtaining of clearance certificate e.g. CTO, EC, HRDS, Fo…"], ["8.", "L&R — RR Schemes as per project. Status of schemes, roadmap/flowchart to complete the RR p…"], ["9.", "Capital Works — Maintenance of Records. Capex plan as per Centralized and Decentralized bu…"], ["10.", "Power Factor — Domestic & Industrial use of powers. Unauthorized Unmetered connection. Com…"], ["11.", "Explosives — Comparison of powder factor & detonator factor with norms and with previous y…"], ["12.", "Fund Management — Stale cheques to be reversed every month and not on annual basis. Report…"], ["13.", "Coal Transport / Weighment — Weighment system of   truck & Rail at loading and unloading p…"], ["14.", "Evacuation problems if any — Whether coal stock is building up due to evacuation problem."], ["15.", "Demurrage & Under loading. — Report on Demurrage & Under-loading."], ["16.", "Production shortfall & reason — Based on actual data reasons from Production Department ma…"], ["17.", "Grade Slippage — If there is any it must be brought out."], ["18.", "Purchase — Maintenance of register for all indents received, date of placement of order et…"], ["19.", "First Mile Connectivity (FMC) — Status of Implementation and progress report."], ["20.", "Billing & realization — If there are slippages beyond a pre-determined amount /time period…"], ["21.", "ESG — New initiatives and project under implementation for ESG and status of control syste…"], ["22.", "Outsourced Patches — Verification of BID documents as per Manuals. Comparison of rate of O…"], ["23.", "FSA — Linkage order Pending Cases at different courts Amount involved No. of settlement of…"], ["24.", "Status of Legal Cases — Pending Cases at different courts. Amount involved No. of settleme…"], ["25.", "GST Compliance — GST Return GST Payment Input Tax Credit"]];
const CWS_APPLIES = new Set(["1","2","3","4","5","6","9","10","12","18","20","24","25"]);
const MONTHS = [["Apr-2026","2026-04-30"],["May-2026","2026-05-31"],["Jun-2026","2026-06-30"],["Jul-2026","2026-07-31"],["Aug-2026","2026-08-31"],["Sep-2026","2026-09-30"],["Oct-2026","2026-10-31"],["Nov-2026","2026-11-30"],["Dec-2026","2026-12-31"],["Jan-2027","2027-01-31"],["Feb-2027","2027-02-28"],["Mar-2027","2027-03-31"]];
const QUARTERS = [["Q1 Apr-Jun 2026","2026-06-30"],["Q2 Jul-Sep 2026","2026-09-30"],["Q3 Oct-Dec 2026","2026-12-31"],["Q4 Jan-Mar 2027","2027-03-31"]];
function addDays(iso,n){const d=new Date(iso+"T00:00:00");d.setDate(d.getDate()+n);return d;}
function fmt(d){return d.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"});}
const PERIODS=[
 ...MONTHS.map(([l,e])=>({id:"M:"+l,label:l,type:"M",end:e,due:addDays(e,15),plabel:"M.E. "+fmt(new Date(e+"T00:00:00"))})),
 ...QUARTERS.map(([l,e])=>({id:"Q:"+l,label:l,type:"Q",end:e,due:addDays(e,21),plabel:"Q.E. "+fmt(new Date(e+"T00:00:00"))})),
 {id:"A:Annual",label:"Annual + IFC 2026-27",type:"A",end:"2027-03-31",due:addDays("2027-03-31",21),plabel:"Annual FY 2026-27"},
];
const AREAS=["Bharatpur","CWS Talcher"];
const STATUSES=["","No exception noted","EXCEPTION","Not due this month","Not due this quarter","N/A"];
function sget(k){try{const v=localStorage.getItem(k);return v?JSON.parse(v):null;}catch(e){}return null;}
function sset(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
function esc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
function download(name,content,mime){try{const b=new Blob([content],{type:mime});const u=URL.createObjectURL(b);const a=document.createElement("a");a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1500);}catch(e){alert("Download failed: "+e.message);}}
// Removes the "--- From <name> ---\n<text>" block that addFiles appended for
// a given attachment, so removing a file also removes its extracted text
// instead of leaving a stale copy behind.
function removeExtractedBlock(existing,name){
 if(!existing)return existing||"";
 const marker="--- From "+name+" ---";
 const idx=existing.indexOf(marker);
 if(idx===-1)return existing;
 const rest=existing.slice(idx+marker.length);
 const nextIdx=rest.indexOf("\n\n--- From ");
 const blockEnd=nextIdx===-1?existing.length:idx+marker.length+nextIdx;
 return (existing.slice(0,idx)+existing.slice(blockEnd)).replace(/\n{3,}/g,"\n\n").replace(/^\n+|\n+$/g,"");
}

export default function App(){
 const [area,setArea]=useState("Bharatpur");
 const [pid,setPid]=useState(PERIODS[0].id);
 const [tab,setTab]=useState("dash");
 const [data,setData]=useState({scope:{},them:{},submitted:false});
 const [saved,setSaved]=useState(true);
 const [ask,setAsk]=useState(null);
 const [importMsg,setImportMsg]=useState(null);
 const period=PERIODS.find(p=>p.id===pid);
 const key="mcl_v1:"+area+":"+pid;
 // Earlier builds prefixed imported report text with a "--- From report: … ---"
 // label. It was never meant to be read, so strip it from saved data on load.
 function dropReportLabels(d){
   if(!d||!d.scope)return d;
   const scope={};
   Object.entries(d.scope).forEach(([k,e])=>{
     const obs=e&&e.obs;
     scope[k]=typeof obs==="string"&&obs.includes("--- From report: ")
       ? {...e,obs:obs.replace(/^[ \t]*--- From report: .*? ---[ \t]*\r?\n?/gm,"").replace(/\n{3,}/g,"\n\n").replace(/^\n+/,"")}
       : e;
   });
   return {...d,scope};
 }
 useEffect(()=>{const d=sget(key);setData(dropReportLabels(d)||{scope:{},them:{},submitted:false});setSaved(true);},[key]);
 useEffect(()=>{setSaved(false);const t=setTimeout(()=>{sset(key,data);setSaved(true);},600);return()=>clearTimeout(t);},[data]);
 // Appends a 5th element (key) to each row: same as ref, except a small
 // number of refs in the source data are genuinely duplicated (e.g. "14.3.2"
 // covers two different questions in Sec 14) — using ref alone as the
 // storage/React key would make those rows silently share one answer. key
 // disambiguates storage/lookup; ref is still what's displayed and exported.
 const coverage=useMemo(()=>{
   const base=area==="CWS Talcher"?THEMATIC.filter(t=>CWS_APPLIES.has(t[0])).map(t=>[t[0],t[1],"CWS thematic","M"]):SCOPE;
   const seen={};
   return base.map(([ref,title,sec,freq])=>{seen[ref]=(seen[ref]||0)+1;const key=seen[ref]>1?ref+"__"+seen[ref]:ref;return[ref,title,sec,freq,key];});
 },[area]);
 function autoStatus(freq){if(period.type==="M"&&(freq==="Q"||freq==="A"))return "Not due this month";if(period.type==="Q"&&freq==="A")return "Not due this quarter";return "";}
 function reasonFor(freq){return freq==="Q"?"This is a quarterly check — reported at quarter-end.":freq==="A"?"This is an annual check — reported at year-end.":"";}
 function setScope(ref,f,v){setData(d=>({...d,scope:{...d.scope,[ref]:{...(d.scope[ref]||{}),[f]:v}}}));}
 function setThem(ref,f,v){setData(d=>({...d,them:{...d.them,[ref]:{...(d.them[ref]||{}),[f]:v}}}));}
 function applyAddedFiles(kind,ref,added){
   if(!added||!added.length)return;
   const block=added.filter(f=>f.text).map(f=>"--- From "+f.name+" ---\n"+f.text).join("\n\n");
   const append=(existing)=>block?(existing?existing+"\n\n"+block:block):existing;
   const anyException=added.some(f=>f.hasException);
   if(kind==="scope"){
     setData(d=>{const cur=d.scope[ref]||{};const files=[...(cur.files||[]),...added];const status=anyException?"EXCEPTION":cur.status;return{...d,scope:{...d.scope,[ref]:{...cur,files,obs:append(cur.obs||""),status}}};});
   }else{
     setData(d=>{const cur=d.them[ref]||{};const files=[...(cur.files||[]),...added];return{...d,them:{...d.them,[ref]:{...cur,files,prob:append(cur.prob||"")}}};});
   }
 }
 async function addFiles(kind,ref){
   if(!window.attachments)return;
   const added=await window.attachments.add({area,period:pid,ref});
   applyAddedFiles(kind,ref,added);
 }
 async function bulkLoadAnnexures(){
   if(!window.attachments||!window.attachments.bulkAdd)return;
   const refs=coverage.map(([,,,,key])=>key);
   const result=await window.attachments.bulkAdd({area,period:pid,refs});
   if(!result)return;
   const byRef=result.byRef||{};
   const matchedRefs=Object.keys(byRef);
   matchedRefs.forEach(ref=>applyAddedFiles("scope",ref,byRef[ref]));
   const exceptionRefs=matchedRefs.filter(ref=>byRef[ref].some(f=>f.hasException));
   const unmatched=result.unmatched||[];
   let msg="Matched "+matchedRefs.length+" scope point(s) across "+(result.filesProcessed||0)+" file(s).";
   msg+="\n"+exceptionRefs.length+" point(s) had rows marked EXCEPTION in their annexure — Observation written and Status set to EXCEPTION automatically.";
   msg+="\n"+(matchedRefs.length-exceptionRefs.length)+" point(s) had no EXCEPTION rows — Status left as-is for you to review.";
   if(unmatched.length){
     msg+="\n\n"+unmatched.length+" sheet(s) could not be matched and were skipped:\n"+unmatched.slice(0,20).map(u=>"• "+u.file+(u.sheet?" ["+u.sheet+"]":"")+" — "+u.reason).join("\n");
     if(unmatched.length>20)msg+="\n… and "+(unmatched.length-20)+" more.";
   }
   alert(msg);
 }

 // ---- Import a finished point-by-point audit report (Word/PDF) -------------
 // Copies each point's own paragraphs from the report into that point's
 // Observation box, word for word. Where the report cannot be read without a
 // judgement call, the app asks rather than guessing.
 function writeReportObs(fills,fileName,mode){
   if(!fills.length)return 0;
   const written=mode==="skip"?fills.filter(f=>!((data.scope[f.key]||{}).obs||"").trim()).length:fills.length;
   setData(d=>{
     const scope={...d.scope};
     fills.forEach(f=>{
       const cur=scope[f.key]||{};
       const existing=cur.obs||"";
       // The report's words go in on their own — no source label, since the
       // Observation is read as the audit opinion, not as a working note.
       const block=f.text;
       let obs;
       if(mode==="replace")obs=block;
       else if(mode==="skip"&&existing.trim())return;
       else obs=existing.trim()?existing+"\n\n"+block:block;
       const status=/^\s*exception\b/i.test(f.status||"")?"EXCEPTION":cur.status;
       scope[f.key]={...cur,obs,status};
     });
     return{...d,scope};
   });
   return written;
 }
 async function importReportObservations(){
   if(!window.reportIO||!window.reportIO.importObservations){alert("This build of the app cannot read reports. Please use the latest version.");return;}
   let r;
   try{r=await window.reportIO.importObservations({points:coverage.map(([ref,title,,freq,key])=>({key,ref,title,notDue:autoStatus(freq).startsWith("Not due")}))});}
   catch(e){alert("The report could not be read.\n\n"+String(e&&e.message?e.message:e));return;}
   if(!r||r.canceled){setImportMsg({kind:"warn",lines:["No file was chosen, so nothing was changed."]});return;}
   if(r.error){setImportMsg({kind:"err",lines:["Could not read \""+r.fileName+"\".",r.error]});alert(r.error);return;}
   const fills=r.fills||[],questions=[...(r.questions||[])];
   if(!fills.length&&!questions.length){
     setImportMsg({kind:"err",lines:["Read \""+r.fileName+"\" — "+(r.paragraphsRead||0)+" paragraph(s).","No paragraph begins with a point number from your scope list, so nothing was copied.",'Each point in the report must start with its number, e.g. "2.7  Unweighed wagons".']});
     alert("Nothing was copied.\n\nThe app read "+(r.paragraphsRead||0)+" paragraph(s) from \""+r.fileName+"\" but found no paragraph that begins with a point number from your scope list (for example \"2.7  Unweighed wagons\").\n\nPlease check that each point in the report starts with its point number.");
     return;
   }
   // Ask about points that already carry an Observation before overwriting.
   const clash=fills.filter(f=>((data.scope[f.key]||{}).obs||"").trim()).length;
   if(clash){
     questions.unshift({id:"__mode",kind:"choose-mode",question:
       clash+" of the points the app is about to fill already have something written in the Observation box.\nWhat should the app do with those?",
       options:[
         {value:"append",label:"Keep what is there and add the report's words below it"},
         {value:"replace",label:"Replace what is there with the report's words"},
         {value:"skip",label:"Leave those "+clash+" points exactly as they are"}]});
   }
   const pending={fileName:r.fileName,fills,questions,skipped:r.skipped||[],notDueSections:r.notDueSections||[]};
   if(questions.length){setAsk({...pending,idx:0,answers:{}});return;}
   finishReportImport(pending,{});
 }
 function finishReportImport(pending,answers){
   const mode=answers.__mode||"append";
   const fills=[...pending.fills];
   let spreadPoints=0;
   pending.questions.forEach(q=>{
     const a=answers[q.id];
     if(!a)return;
     if(q.kind==="choose-point")fills.push({key:a,ref:a,reportRef:q.payload.reportRef,title:q.payload.title,status:q.payload.status,text:q.payload.text});
     if(q.kind==="choose-spread"&&a==="spread"){q.payload.keys.forEach(k=>{fills.push({key:k,ref:k,title:"",status:"",text:q.payload.text});spreadPoints++;});}
   });
   const written=writeReportObs(fills,pending.fileName,mode);
   setAsk(null);
   let msg="Report read: "+pending.fileName+"\n\n"+written+" point(s) filled from the report"+(mode==="skip"?" (points that already had text were left alone)":mode==="replace"?" (existing text replaced)":" (added below any existing text)")+".";
   if(spreadPoints)msg+="\n"+spreadPoints+" of those came from a Section paragraph you chose to spread across its points.";
   const untouched=(pending.skipped||[]).length;
   if(untouched)msg+="\n\n"+untouched+" scope point(s) had no matching paragraph in the report and were left untouched.";
   (pending.notDueSections||[]).forEach(sn=>{msg+="\nSection "+sn.section+(sn.title?" ("+sn.title+")":"")+" — all "+sn.points+" point(s) are reported at quarter- or year-end, so they are not due in this period and were left blank.";});
   msg+="\n\nNothing was reworded or summarised — the report's own words were copied across.";
   setImportMsg({kind:written?"ok":"warn",lines:msg.split("\n").filter(Boolean)});
   alert(msg);
 }
 // Empties the Observation box of every Scope Coverage point in one go.
 // Attached files, Status and Management Reply are left alone — only the
 // Observation text is cleared.
 function clearAllObservations(){
   const filled=coverage.filter(([,,,,key])=>((data.scope[key]||{}).obs||"").trim());
   if(!filled.length){alert("No observations to clear for "+area+" / "+period.label+".");return;}
   if(!window.confirm("Clear the Observation text of all "+filled.length+" Scope Coverage point(s) for "+area+" / "+period.label+"?\n\nThis empties the Observation boxes only. Attached files, Status and Management Reply are kept. This cannot be undone."))return;
   setData(d=>{
     const scope={...d.scope};
     filled.forEach(([,,,,key])=>{const cur=scope[key];if(cur)scope[key]={...cur,obs:""};});
     return{...d,scope};
   });
   alert("Cleared the Observation of "+filled.length+" point(s).");
 }
 async function clearAllAttachments(){
   const removals=[];
   Object.entries(data.scope).forEach(([ref,e])=>{(e&&e.files||[]).forEach(f=>removals.push({ref,relPath:f.relPath,name:f.name}));});
   if(!removals.length){alert("No attachments to clear for "+area+" / "+period.label+".");return;}
   const pointCount=Object.values(data.scope).filter(e=>e&&e.files&&e.files.length).length;
   if(!window.confirm("Remove all "+removals.length+" attached file(s) across "+pointCount+" Scope Coverage point(s) for "+area+" / "+period.label+"?\n\nThis deletes the files and the text they added to Observation, but keeps anything you typed yourself. This cannot be undone."))return;
   if(window.attachments){
     await Promise.all(removals.map(r=>window.attachments.remove(r.relPath).catch(()=>{})));
   }
   setData(d=>{
     const scope={...d.scope};
     Object.keys(scope).forEach(ref=>{
       const cur=scope[ref];
       if(!cur||!cur.files||!cur.files.length)return;
       let obs=cur.obs||"";
       cur.files.forEach(f=>{obs=removeExtractedBlock(obs,f.name);});
       scope[ref]={...cur,files:[],obs};
     });
     return{...d,scope};
   });
   alert("Removed "+removals.length+" file(s) across "+pointCount+" point(s).");
 }
 async function removeFileAt(kind,ref,idx,relPath){
   if(window.attachments)await window.attachments.remove(relPath);
   if(kind==="scope"){
     setData(d=>{const cur=d.scope[ref]||{};const removed=(cur.files||[])[idx];const files=(cur.files||[]).filter((_,i)=>i!==idx);const obs=removed?removeExtractedBlock(cur.obs,removed.name):cur.obs;return{...d,scope:{...d.scope,[ref]:{...cur,files,obs}}};});
   }else{
     setData(d=>{const cur=d.them[ref]||{};const removed=(cur.files||[])[idx];const files=(cur.files||[]).filter((_,i)=>i!==idx);const prob=removed?removeExtractedBlock(cur.prob,removed.name):cur.prob;return{...d,them:{...d.them,[ref]:{...cur,files,prob}}};});
   }
 }
 function openFile(relPath){if(window.attachments)window.attachments.open(relPath);}
 const counts=useMemo(()=>{let exc=0,cov=0,nd=0;coverage.forEach(([,,,freq,key])=>{const e=data.scope[key]||{};const st=e.status||autoStatus(freq);if(st==="EXCEPTION")exc++;if(st&&!st.startsWith("Not due"))cov++;if(st.startsWith("Not due"))nd++;});return{total:coverage.length,exc,cov,nd};},[coverage,data,period]);
 const daysLeft=Math.ceil((period.due-new Date())/86400000);
 return (
 <div className="min-h-screen bg-slate-50 text-slate-800" style={{fontFamily:"system-ui,Segoe UI,Arial"}}>
   <div className="bg-[#1F3864] text-white px-5 py-3 flex flex-wrap items-center gap-3 shadow">
     <div className="font-bold text-lg tracking-wide">MCL Internal Audit — Report Builder</div>
     <div className="text-xs opacity-80">C K Prusty &amp; Associates · FY 2026-27</div>
     <div className="text-[10px] opacity-70 leading-tight" title="Use this to check you are running the latest download.">v{BUILD_VERSION}<br/>built {BUILD_DATE}</div>
     <div className="ml-auto text-xs"><span className={saved?"text-green-300":"text-amber-300"}>{saved?"✔ saved":"saving…"}</span></div>
   </div>
   <div className="px-5 py-3 bg-white border-b flex flex-wrap gap-3 items-end">
     <label className="text-xs font-semibold text-slate-600">Area<select value={area} onChange={e=>setArea(e.target.value)} className="block mt-1 border rounded px-2 py-1 text-sm">{AREAS.map(a=><option key={a}>{a}</option>)}</select></label>
     <label className="text-xs font-semibold text-slate-600">Period<select value={pid} onChange={e=>setPid(e.target.value)} className="block mt-1 border rounded px-2 py-1 text-sm min-w-[220px]"><optgroup label="Monthly">{PERIODS.filter(p=>p.type==="M").map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</optgroup><optgroup label="Quarterly">{PERIODS.filter(p=>p.type==="Q").map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</optgroup><optgroup label="Annual">{PERIODS.filter(p=>p.type==="A").map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</optgroup></select></label>
     <div className="text-xs text-slate-600">Report label:<div className="font-bold text-slate-800">{period.plabel}</div></div>
     <div className="text-xs text-slate-600">Due:<div className="font-bold text-slate-800">{fmt(period.due)}</div></div>
     <div className={"text-xs px-2 py-1 rounded font-bold "+(daysLeft<0?"bg-red-100 text-red-700":daysLeft<7?"bg-amber-100 text-amber-800":"bg-green-100 text-green-700")}>{daysLeft<0?Math.abs(daysLeft)+" days overdue":daysLeft+" days left"}</div>
     <label className="ml-auto text-xs font-semibold flex items-center gap-1"><input type="checkbox" checked={!!data.submitted} onChange={e=>setData(d=>({...d,submitted:e.target.checked}))}/> Submitted</label>
   </div>
   <div className="px-5 pt-3 flex gap-1 text-sm">{[["dash","Dashboard"],["scope","Scope Coverage"],["exc","25-Point Exceptions"],["report","Report & Export"]].map(([k,l])=><button key={k} onClick={()=>setTab(k)} className={"px-3 py-2 rounded-t font-semibold "+(tab===k?"bg-white text-[#1F3864] border border-b-white":"bg-slate-200 text-slate-600")}>{l}</button>)}</div>
   <div className="mx-5 mb-8 bg-white border rounded-b rounded-tr p-4 shadow-sm">
   {tab==="dash"&&(<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
       <Card n={counts.total} t="Scope points" c="#1F3864"/><Card n={counts.cov} t="Covered" c="#2f7d3a"/><Card n={counts.exc} t="Exceptions" c="#C00000"/><Card n={counts.nd} t="Not due (this period)" c="#B8860B"/>
       <div className="col-span-2 md:col-span-4 text-sm text-slate-600 mt-2"><b>How to use:</b> choose Area and Period. In <b>Scope Coverage</b> mark each point and write the Observation &amp; Management Reply. In <b>25-Point Exceptions</b> fill the summary. Open <b>Report &amp; Export</b> to print or download Word/Excel. Saved automatically on this computer; stays here next time.
       <div className="mt-2 text-xs text-slate-500">This app tracks findings and builds the report tables. It does not read your Excel annexures — keep filling those in separately.</div></div></div>)}
   {tab==="scope"&&(<div className="overflow-x-auto">
       <div className="flex items-center gap-2 mb-2">
         <button type="button" onClick={bulkLoadAnnexures} className="text-xs px-2 py-1.5 rounded border border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100 font-semibold">📎 Bulk Load Annexures (Excel / Word / PDF)</button>
         <button type="button" onClick={importReportObservations} className="text-xs px-2 py-1.5 rounded border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-semibold">📄 Load Observations from Report (Word / PDF)</button>
         <button type="button" onClick={clearAllObservations} className="text-xs px-2 py-1.5 rounded border border-red-300 bg-red-50 text-red-700 hover:bg-red-100 font-semibold">🧹 Clear All Observations</button>
         <button type="button" onClick={clearAllAttachments} className="text-xs px-2 py-1.5 rounded border border-red-300 bg-red-50 text-red-700 hover:bg-red-100 font-semibold">🗑️ Clear All Attachments</button>
         <span className="text-[10px] text-slate-400">Matched automatically: Excel sheets named after a point (e.g. "1.1.2a"), and Word/PDF sections headed "Annexure 1.1.2a — …". A finished report is matched on paragraphs that start with the point number, e.g. "2.7  Unweighed wagons".</span>
       </div>
       {importMsg&&<div className={"text-xs mb-2 rounded p-2 border "+(importMsg.kind==="ok"?"bg-green-50 border-green-300 text-green-900":importMsg.kind==="warn"?"bg-amber-50 border-amber-300 text-amber-900":"bg-red-50 border-red-300 text-red-900")}>
         <div className="flex items-start gap-2">
           <div className="flex-1">{importMsg.lines.map((l,i)=><div key={i} className={i===0?"font-semibold":""}>{l}</div>)}</div>
           <button type="button" onClick={()=>setImportMsg(null)} className="text-[10px] underline shrink-0">Dismiss</button>
         </div></div>}
       {area==="CWS Talcher"&&<div className="text-xs mb-2 text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">CWS Talcher: Sections 1 &amp; 2 Not Applicable. Showing the 13 applicable thematic points.</div>}
       <table className="w-full text-xs border-collapse"><thead><tr className="bg-[#1F3864] text-white text-left"><th className="p-2 w-24">Ref</th><th className="p-2">Scope of Work</th><th className="p-2 w-40">Status</th><th className="p-2">Observation</th><th className="p-2">Management Reply</th><th className="p-2 w-32">Files</th></tr></thead><tbody>
         {coverage.map(([ref,title,sec,freq,key])=>{const e=data.scope[key]||{};const st=e.status||autoStatus(freq);const nd=st.startsWith("Not due");
           return(<tr key={key} className={"border-b align-top "+(st==="EXCEPTION"?"bg-red-50":nd?"bg-amber-50":"")}>
             <td className="p-2 font-mono font-bold text-slate-700">{ref}{freq!=="M"&&<span className="ml-1 text-[9px] px-1 rounded bg-slate-200 text-slate-600">{freq}</span>}</td>
             <td className="p-2">{title}<div className="text-[10px] text-slate-400">{sec}</div></td>
             <td className="p-2"><select value={st} onChange={ev=>setScope(key,"status",ev.target.value)} className="border rounded px-1 py-1 w-full">{STATUSES.map(s=><option key={s} value={s}>{s||"— select —"}</option>)}</select>{nd&&<div className="text-[10px] text-amber-700 mt-1">{reasonFor(freq)}</div>}</td>
             <td className="p-2"><textarea value={e.obs||""} onChange={ev=>setScope(key,"obs",ev.target.value)} rows={2} placeholder={st==="No exception noted"?"No exception noted":"observation…"} className="border rounded w-full p-1 text-xs"/>{e.obs&&<button type="button" onClick={()=>{if(window.confirm("Clear the Observation text for "+ref+"?"))setScope(key,"obs","");}} className="text-[10px] text-red-600 underline mt-0.5">Clear</button>}</td>
             <td className="p-2"><textarea value={e.reply||""} onChange={ev=>setScope(key,"reply",ev.target.value)} rows={2} placeholder="management reply…" className="border rounded w-full p-1 text-xs"/></td>
             <td className="p-2"><FileCell files={e.files} onAdd={()=>addFiles("scope",key)} onRemove={(idx,rp)=>removeFileAt("scope",key,idx,rp)} onOpen={openFile}/></td></tr>);})}
       </tbody></table></div>)}
   {tab==="exc"&&(<div className="overflow-x-auto"><table className="w-full text-xs border-collapse"><thead><tr className="bg-[#1F3864] text-white text-left"><th className="p-2 w-10">Sl</th><th className="p-2">Description</th><th className="p-2">Problem</th><th className="p-2">Auditor's Comment</th><th className="p-2">Management Comment</th><th className="p-2 w-32">Files</th></tr></thead><tbody>
         {THEMATIC.map(([ref,desc])=>{const applies=area!=="CWS Talcher"||CWS_APPLIES.has(ref);const e=data.them[ref]||{};
           return(<tr key={ref} className={"border-b align-top "+(applies?"":"opacity-40")}><td className="p-2 font-bold">{ref}</td><td className="p-2">{desc}{!applies&&<div className="text-[10px] text-slate-400">N/A for CWS</div>}</td>
             <td className="p-2"><textarea disabled={!applies} value={e.prob||""} onChange={ev=>setThem(ref,"prob",ev.target.value)} rows={2} className="border rounded w-full p-1 text-xs"/>{applies&&e.prob&&<button type="button" onClick={()=>{if(window.confirm("Clear the Problem text for "+ref+"?"))setThem(ref,"prob","");}} className="text-[10px] text-red-600 underline mt-0.5">Clear</button>}</td>
             <td className="p-2"><textarea disabled={!applies} value={e.aud||""} onChange={ev=>setThem(ref,"aud",ev.target.value)} rows={2} className="border rounded w-full p-1 text-xs"/></td>
             <td className="p-2"><textarea disabled={!applies} value={e.mgmt||""} onChange={ev=>setThem(ref,"mgmt",ev.target.value)} rows={2} className="border rounded w-full p-1 text-xs"/></td>
             <td className="p-2"><FileCell files={e.files} disabled={!applies} onAdd={()=>addFiles("them",ref)} onRemove={(idx,rp)=>removeFileAt("them",ref,idx,rp)} onOpen={openFile}/></td></tr>);})}
       </tbody></table></div>)}
   {tab==="report"&&<Report area={area} period={period} data={data} coverage={coverage} autoStatus={autoStatus} reasonFor={reasonFor}/>}
   </div>
   <div className="text-center text-[10px] text-slate-400 pb-6">Data stored privately on this computer; persists across sessions. No figures are invented — you enter every observation.</div>
   {ask&&<AskDialog ask={ask} onAnswer={(id,value)=>setAsk(a=>({...a,answers:{...a.answers,[id]:value},idx:a.idx+1}))} onCancel={()=>setAsk(null)} onDone={answers=>finishReportImport(ask,answers)}/>}
 </div>);
}

// Puts one plain-language question at a time to the user while a report is
// being read. Nothing is written to the app until every question is answered.
function AskDialog({ask,onAnswer,onCancel,onDone}){
  const q=ask.questions[ask.idx];
  useEffect(()=>{if(!q)onDone(ask.answers);},[q]);
  if(!q)return null;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-6 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-5">
        <div className="text-xs font-semibold text-slate-500 mb-1">Reading &ldquo;{ask.fileName}&rdquo; — question {ask.idx+1} of {ask.questions.length}</div>
        <div className="text-sm text-slate-800 whitespace-pre-line mb-4">{q.question}</div>
        {q.payload&&q.payload.text&&<div className="text-[11px] text-slate-600 bg-amber-50 border border-amber-200 rounded p-2 mb-4 max-h-40 overflow-y-auto whitespace-pre-line">{q.payload.text.slice(0,700)}{q.payload.text.length>700?"…":""}</div>}
        <div className="flex flex-col gap-2">
          {q.options.map((o,i)=><button key={i} type="button" onClick={()=>onAnswer(q.id,o.value)} className="text-left text-sm border rounded px-3 py-2 hover:bg-emerald-50 hover:border-emerald-300">{o.label}</button>)}
        </div>
        <div className="mt-4 text-right"><button type="button" onClick={onCancel} className="text-xs text-slate-500 underline">Stop and change nothing</button></div>
      </div>
    </div>);
}
function Card({n,t,c}){return <div className="rounded border p-3 text-center" style={{borderTopColor:c,borderTopWidth:3}}><div className="text-2xl font-bold" style={{color:c}}>{n}</div><div className="text-xs text-slate-500">{t}</div></div>;}

function bytesFmt(n){if(n==null)return "";if(n<1024)return n+" B";if(n<1024*1024)return (n/1024).toFixed(0)+" KB";return (n/1024/1024).toFixed(1)+" MB";}

function FileCell({files,disabled,onAdd,onRemove,onOpen}){
 const hasApi=typeof window!=="undefined"&&!!window.attachments;
 return(<div className="flex flex-col gap-1">
   {(files||[]).map((f,i)=>(
     <div key={i} className="flex items-center gap-1 text-[10px] bg-slate-100 rounded px-1 py-0.5">
       <button type="button" onClick={()=>onOpen(f.relPath)} title={f.name+" ("+bytesFmt(f.size)+")"} className="truncate max-w-[110px] text-blue-700 underline text-left">{f.name}</button>
       <button type="button" onClick={()=>onRemove(i,f.relPath)} title="Remove" className="text-red-500 font-bold px-0.5">×</button>
     </div>
   ))}
   {!disabled&&hasApi&&<button type="button" onClick={onAdd} className="text-[10px] px-1.5 py-0.5 rounded border border-slate-300 text-slate-600 hover:bg-slate-50 self-start">+ Attach</button>}
   {!hasApi&&!disabled&&<div className="text-[9px] text-slate-400">Attachments need the desktop app</div>}
 </div>);
}

function Report({area,period,data,coverage,autoStatus,reasonFor}){
 // A4 portrait or landscape, applied to the print view, the PDF and the Word
 // file alike so all three come out on the same page.
 const [orient,setOrient]=useState(()=>{try{return localStorage.getItem("mcl_v1:orientation")||"landscape";}catch(e){return "landscape";}});
 useEffect(()=>{try{localStorage.setItem("mcl_v1:orientation",orient);}catch(e){}},[orient]);
 // @page cannot be switched by a class, so the rule itself is rewritten.
 useEffect(()=>{
   let el=document.getElementById("mcl-page-size");
   if(!el){el=document.createElement("style");el.id="mcl-page-size";document.head.appendChild(el);}
   el.textContent="@page{size:A4 "+orient+";margin:10mm}";
 },[orient]);
 // The Status chosen for a point is repeated at the end of its observation
 // so the report itself carries the opinion, not just the on-screen dropdown.
 function obsText(ref,freq){const e=data.scope[ref]||{};const st=e.status||autoStatus(freq);if(e.obs)return st?e.obs.replace(/\s+$/,"")+"\n\nStatus: "+st:e.obs;if(st==="No exception noted")return "No exception noted";if(st.startsWith("Not due"))return st+" — "+reasonFor(freq);if(st==="N/A")return "Not applicable";if(st==="EXCEPTION")return "(exception — enter observation)";return "";}
 function tablesFor(key){return((data.scope[key]||{}).files||[]).filter(f=>f.table&&f.table.headers&&f.table.headers.length&&f.table.rows&&f.table.rows.length).map(f=>({...f.table,fileName:f.name}));}
 function nestedTableHTML(t){
   let s="<div style='margin-top:4px'><i style='font-size:9px'>Source data"+(t.fileName?(" — "+esc(t.fileName)):"")+":</i>";
   s+="<table style='border-collapse:collapse;width:100%;margin-top:2px'><tr>"+t.headers.map(h=>"<th style='border:1px solid #999;padding:2px;background:#FBF6EC;font-size:9px;text-align:left'>"+esc(h)+"</th>").join("")+"</tr>";
   t.rows.forEach(r=>{s+="<tr>"+r.map(v=>"<td style='border:1px solid #ccc;padding:2px;font-size:9px'>"+esc(v)+"</td>").join("")+"</tr>";});
   s+="</table></div>";
   return s;
 }
 function obsCellHTML(key,freq){
   const text=esc(obsText(key,freq)).replace(/\n/g,"<br/>");
   return text+tablesFor(key).map(nestedTableHTML).join("");
 }
 // Header rows go in <thead> and data rows in <tbody>, so the print and PDF
 // renderers repeat the header at the top of every page.
 function buildHTML(forWord){
   const th="border:1px solid #444;padding:4px;background:#1F3864;color:#fff;text-align:left;font-size:11px";
   const td="border:1px solid #999;padding:4px;font-size:11px;vertical-align:top;white-space:pre-line";
   let h="<div style='font-family:Georgia,serif'>";
   h+="<div style='text-align:center'><b>C K PRUSTY &amp; ASSOCIATES, Chartered Accountants</b><br>Internal Audit — "+esc(area)+", MCL &middot; "+esc(period.plabel)+"</div>";
   h+="<h3 style='color:#1F3864'>A. Scope-Coverage Statement</h3><table style='border-collapse:collapse;width:100%'><thead><tr><th style='"+th+"'>Sl No</th><th style='"+th+"'>Scope of Work</th><th style='"+th+"'>Observation</th><th style='"+th+"'>Management Reply</th></tr></thead><tbody>";
   coverage.forEach(([ref,title,,freq,key])=>{h+="<tr><td style='"+td+"'>"+esc(ref)+"</td><td style='"+td+"'>"+esc(title)+"</td><td style='"+td+"'>"+obsCellHTML(key,freq)+"</td><td style='"+td+"'>"+esc((data.scope[key]||{}).reply||"")+"</td></tr>";});
   h+="</tbody></table><h3 style='color:#1F3864'>B. Report of Exception — 25 Points</h3><table style='border-collapse:collapse;width:100%'><thead><tr><th style='"+th+"'>Sl</th><th style='"+th+"'>Description</th><th style='"+th+"'>Problem</th><th style='"+th+"'>Auditor's Comment</th><th style='"+th+"'>Management Comment</th></tr></thead><tbody>";
   THEMATIC.forEach(([ref,desc])=>{const e=data.them[ref]||{};h+="<tr><td style='"+td+"'>"+esc(ref)+"</td><td style='"+td+"'>"+esc(desc)+"</td><td style='"+td+"'>"+esc(e.prob||"")+"</td><td style='"+td+"'>"+esc(e.aud||"No exception noted")+"</td><td style='"+td+"'>"+esc(e.mgmt||"")+"</td></tr>";});
   h+="</tbody></table><p style='font-size:10px;font-style:italic;border-top:1px solid #444;padding-top:4px'>Non-Assumption / Non-Hallucination Certificate: All observations and figures are entered by the auditor from management-supplied records. No figures have been assumed or invented.</p></div>";
   return h;
 }
 function reportPayload(){
   const fileBase="Report_"+area.replace(/ /g,"")+"_"+period.label.replace(/ /g,"");
   const coverageRows=coverage.map(([ref,title,,freq,key])=>({ref,title,observation:obsText(key,freq),reply:(data.scope[key]||{}).reply||"",tables:tablesFor(key)}));
   const thematicRows=THEMATIC.map(([ref,desc])=>{const e=data.them[ref]||{};return{ref,desc,prob:e.prob||"",aud:e.aud||"No exception noted",mgmt:e.mgmt||""};});
   return{area,periodLabel:period.plabel,fileBase,coverage:coverageRows,thematic:thematicRows,orientation:orient};
 }
 // The report's own markup, sent to the main process to be rendered as a real
 // PDF by Chromium — the same bytes whether it is previewed or saved.
 function pdfPayload(){return{fileBase:reportPayload().fileBase,html:buildHTML(false),orientation:orient};}
 async function previewPdf(){
   if(!window.reportIO||!window.reportIO.previewPdf){window.print();return;}
   try{
     const r=await window.reportIO.previewPdf(pdfPayload());
     if(!r.ok)alert("Could not open the print preview: "+(r.error||"unknown error"));
   }catch(e){alert("Could not open the print preview.\n\n"+String(e&&e.message?e.message:e));}
 }
 async function dlPdf(){
   if(!window.reportIO||!window.reportIO.savePdf){window.print();return;}
   try{
     const r=await window.reportIO.savePdf(pdfPayload());
     if(!r.ok&&!r.canceled)alert("Could not save the PDF: "+(r.error||"unknown error"));
   }catch(e){alert("Could not save the PDF.\n\n"+String(e&&e.message?e.message:e));}
 }
 async function dlWord(){
   try{
     if(window.reportIO&&window.reportIO.saveDocx){
       const r=await window.reportIO.saveDocx(reportPayload());
       if(!r.ok&&!r.canceled)alert("Could not save the file: "+(r.error||"unknown error"));
     }else{
       const html="<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'><head><meta charset='utf-8'></head><body>"+buildHTML(true)+"</body></html>";
       download(reportPayload().fileBase+".doc",html,"application/msword");
     }
   }catch(e){alert("Download Word failed: "+e.message);}
 }
 async function dlExcel(){
   try{
     if(window.reportIO&&window.reportIO.saveXlsx){
       const r=await window.reportIO.saveXlsx(reportPayload());
       if(!r.ok&&!r.canceled)alert("Could not save the file: "+(r.error||"unknown error"));
     }else{
       const html="<html xmlns:x='urn:schemas-microsoft-com:office:excel'><head><meta charset='utf-8'></head><body>"+buildHTML(false)+"</body></html>";
       download(reportPayload().fileBase+".xls",html,"application/vnd.ms-excel");
     }
   }catch(e){alert("Download Excel failed: "+e.message);}
 }
 async function copyRep(){
   try{
     const el=document.getElementById("rep");
     const text=el?el.innerText:"";
     if(window.reportIO){
       const r=await window.reportIO.copyHtml({html:buildHTML(false),text});
       if(!r.ok)alert("Copy failed: "+(r.error||"unknown error"));
     }else{
       const r=document.createRange();r.selectNode(el);const s=window.getSelection();s.removeAllRanges();s.addRange(r);try{document.execCommand("copy");}catch(e){}s.removeAllRanges();
     }
   }catch(e){alert("Copy failed: "+e.message);}
 }
 return(<div>
   <div className="flex flex-wrap gap-2 mb-3 print:hidden">
     <label className="text-xs font-semibold text-slate-600 mr-1">Page
       <select value={orient} onChange={e=>setOrient(e.target.value)} className="ml-1 border rounded px-2 py-1 text-sm font-normal">
         <option value="landscape">A4 Landscape</option>
         <option value="portrait">A4 Portrait</option>
       </select></label>
     <button onClick={previewPdf} className="px-3 py-1.5 rounded bg-[#1F3864] text-white text-sm font-semibold">Print Preview</button>
     <button onClick={dlPdf} className="px-3 py-1.5 rounded bg-[#8B3A62] text-white text-sm font-semibold">Download PDF</button>
     <button onClick={()=>window.print()} className="px-3 py-1.5 rounded bg-slate-600 text-white text-sm font-semibold">Print</button>
     <button onClick={dlWord} className="px-3 py-1.5 rounded bg-[#2E5496] text-white text-sm font-semibold">Download Word</button>
     <button onClick={dlExcel} className="px-3 py-1.5 rounded bg-[#2f7d3a] text-white text-sm font-semibold">Download Excel</button>
     <button onClick={copyRep} className="px-3 py-1.5 rounded bg-[#B8860B] text-white text-sm font-semibold">Copy tables</button>
   </div>
   <div id="rep" className="text-xs">
     <div className="text-center mb-1"><div className="font-bold text-sm">C K PRUSTY &amp; ASSOCIATES, Chartered Accountants</div><div>Internal Audit — {area}, MCL · {period.plabel}</div></div>
     <h3 className="font-bold text-[#1F3864] mt-3 mb-1">A. Scope-Coverage Statement</h3>
     <table className="w-full border-collapse mb-4"><thead><tr className="bg-slate-100"><th className="border p-1 w-16">Sl No</th><th className="border p-1 text-left">Scope of Work</th><th className="border p-1 text-left">Observation</th><th className="border p-1 text-left">Management Reply</th></tr></thead>
       <tbody>{coverage.map(([ref,title,,freq,key])=><tr key={key}><td className="border p-1 font-mono">{ref}</td><td className="border p-1">{title}</td><td className="border p-1" dangerouslySetInnerHTML={{__html:obsCellHTML(key,freq)}}/><td className="border p-1 whitespace-pre-line">{(data.scope[key]||{}).reply||""}</td></tr>)}</tbody></table>
     <h3 className="font-bold text-[#1F3864] mt-3 mb-1">B. Report of Exception — 25 Points</h3>
     <table className="w-full border-collapse"><thead><tr className="bg-slate-100"><th className="border p-1 w-10">Sl</th><th className="border p-1 text-left">Description</th><th className="border p-1 text-left">Problem</th><th className="border p-1 text-left">Auditor's Comment</th><th className="border p-1 text-left">Management Comment</th></tr></thead>
       <tbody>{THEMATIC.map(([ref,desc])=>{const e=data.them[ref]||{};return <tr key={ref}><td className="border p-1">{ref}</td><td className="border p-1">{desc}</td><td className="border p-1 whitespace-pre-line">{e.prob||""}</td><td className="border p-1 whitespace-pre-line">{e.aud||"No exception noted"}</td><td className="border p-1 whitespace-pre-line">{e.mgmt||""}</td></tr>;})}</tbody></table>
     <div className="mt-4 text-[10px] italic border-t pt-2">Non-Assumption / Non-Hallucination Certificate: All observations and figures are entered by the auditor from management-supplied records. No figures have been assumed or invented by the tool.</div>
   </div>
 </div>);
}
