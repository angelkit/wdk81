////////////////////////////////////////////////////////////////////////////////////////////////////
//
//   Copyright (c) 2012 Microsoft Corporation.  All Rights Reserved.
//
//   Module Name:
//      ClassifyFunctions_BasicPacketExaminationCallouts.h
//
//   Abstract:
//      This module contains prototypes of WFP Classify functions for examining indicated 
//         NET_BUFFER_LISTS.
//
//   Author:
//      Dusty Harper      (DHarper)
//
//   Revision History:
//
//      [ Month ][Day] [Year] - [Revision]-[ Comments ]
//      May       01,   2010  -     1.0   -  Creation
//
////////////////////////////////////////////////////////////////////////////////////////////////////

#ifndef CLASSIFY_BASIC_PACKET_EXAMINATION_H
#define CLASSIFY_BASIC_PACKET_EXAMINATION_H

#if(NTDDI_VERSION >= NTDDI_WIN7)

_IRQL_requires_min_(PASSIVE_LEVEL)
_IRQL_requires_max_(DISPATCH_LEVEL)
_IRQL_requires_same_
VOID ClassifyBasicPacketExamination(_In_ const FWPS_INCOMING_VALUES* pClassifyValues,
                                    _In_ const FWPS_INCOMING_METADATA_VALUES* pMetadata,
                                    _Inout_opt_ VOID* pLayerData,
                                    _In_opt_ const VOID* pClassifyContext,
                                    _In_ const FWPS_FILTER* pFilter,
                                    _In_ UINT64 flowContext,
                                    _Inout_ FWPS_CLASSIFY_OUT* pClassifyOut);

#else

_IRQL_requires_min_(PASSIVE_LEVEL)
_IRQL_requires_max_(DISPATCH_LEVEL)
_IRQL_requires_same_
VOID ClassifyBasicPacketExamination(_In_ const FWPS_INCOMING_VALUES* pClassifyValues,
                                    _In_ const FWPS_INCOMING_METADATA_VALUES* pMetadata,
                                    _Inout_opt_ VOID* pLayerData,
                                    _In_ const FWPS_FILTER* pFilter,
                                    _In_ UINT64 flowContext,
                                    _Inout_ FWPS_CLASSIFY_OUT* pClassifyOut);

#endif /// (NTDDI_VERSION >= NTDDI_WIN7)

#endif /// CLASSIFY_BASIC_PACKET_EXAMINATION_H